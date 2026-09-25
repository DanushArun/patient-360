import snowflake from "snowflake-sdk";
import type { ProfessionalLogin } from "./session-security";
import { withBoundPatientSession } from "./session-security";
import { requireSnowflakeAccount } from "./snowflake-config";

// NOT cached as a module singleton, deliberately. BIND_PATIENT and every agent
// tool resolve their subject from PATIENT_BINDING keyed on CURRENT_SESSION() -
// exactly the same server-side design as the Streamlit app (frontend/streamlit_app.py).
// A cached connection shared across every Next.js request means every visitor
// shares ONE CURRENT_SESSION(), so whoever binds last determines what every
// other request sees - the identical cross-user leak found and fixed in the
// The browser login is passed through once and never persisted by this server.
function openConnection(login: ProfessionalLogin): Promise<snowflake.Connection> {
  const conn = snowflake.createConnection({
    account: requireSnowflakeAccount(),
    username: login.username,
    password: login.password,
    authenticator: "SNOWFLAKE",
    // The web app runs with the same least-privileged role as the Streamlit
    // app. Secondary roles are disabled immediately after connect below.
    role: "SAARTHI_APP",
  });
  return new Promise((resolve, reject) => {
    conn.connect((err, c) => {
      if (err) {
        // A failed connect can still allocate SDK resources. Do not leave them
        // behind when no caller ever receives the connection.
        conn.destroy(() => reject(new Error("professional_login_invalid")));
        return;
      }
      resolve(c);
    });
  });
}

function destroyConnection(conn: snowflake.Connection): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.destroy((err) => err ? reject(err) : resolve());
  });
}

/** One-off query: opens, runs, closes. Use for stateless reads (census, etc). */
export async function query<T = Record<string, unknown>>(
  sqlText: string,
  binds: (string | number | null)[] = [],
  login: ProfessionalLogin,
): Promise<T[]> {
  const conn = await openConnection(login);
  try {
    await execOn(conn, "USE SECONDARY ROLES NONE");
    return await execOn<T>(conn, sqlText, binds);
  } finally {
    await destroyConnection(conn);
  }
}

function execOn<T = Record<string, unknown>>(
  conn: snowflake.Connection,
  sqlText: string,
  binds: (string | number | null)[] = []
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    conn.execute({
      sqlText,
      binds,
      complete: (err, _stmt, rows) => {
        if (err) return reject(err);
        resolve((rows ?? []) as T[]);
      },
    });
  });
}

/**
 * A session for one request that needs binding: BIND_PATIENT then one or more
 * agent calls that must resolve to that same binding server-side. Always
 * releases the binding and closes the connection when done, so a crashed
 * request can't leave a binding (or a Snowflake session) dangling.
 */
export async function withPatientSession<T>(
  patientId: string,
  fn: (run: (sql: string, binds?: (string | number | null)[]) => Promise<Record<string, unknown>[]>) => Promise<T>,
  login: ProfessionalLogin,
): Promise<T> {
  const conn = await openConnection(login);
  const run = (sql: string, binds: (string | number | null)[] = []) => execOn(conn, sql, binds);
  return withBoundPatientSession({ execute: run, destroy: () => destroyConnection(conn) }, patientId, fn);
}

export async function withPatientSessionAndContext<T>(
  patientId: string,
  fn: (run: (sql: string, binds?: (string | number | null)[]) => Promise<Record<string, unknown>[]>, context: PatientBinding) => Promise<T>,
  login: ProfessionalLogin,
): Promise<T> {
  return withPatientSession(patientId, async (run) => {
    const rows = await run("CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_CONTEXT()");
    const raw = Object.values(rows[0] ?? {})[0];
    let context: Record<string, unknown>;
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (!parsed || typeof parsed !== "object") throw new Error();
      context = parsed as Record<string, unknown>;
    } catch {
      throw new Error("patient_context_unavailable");
    }
    if (typeof context.error === "string") {
      // Procedure denials are deliberately kept generic at the HTTP boundary.
      throw new Error("no_patient_access");
    }
    return fn(run, {
      patientId,
      patientName: typeof context.NAME === "string" ? context.NAME : (() => { throw new Error("patient_context_unavailable"); })(),
      consentId: typeof context.CONSENT_ID === "string" ? context.CONSENT_ID : null,
      language: typeof context.PRIMARY_LANGUAGE === "string" ? context.PRIMARY_LANGUAGE : null,
      nextVisit: typeof context.SCHEDULED_AT === "string" ? context.SCHEDULED_AT.slice(0, 10) : null,
      scheduledAt: typeof context.SCHEDULED_AT === "string" ? context.SCHEDULED_AT : null,
      cycleNumber: typeof context.CYCLE_NUMBER === "number" ? context.CYCLE_NUMBER : null,
      regimen: typeof context.REGIMEN_DISPLAY === "string" ? context.REGIMEN_DISPLAY : null,
      practitionerName: String(context.PRACTITIONER_NAME ?? ""),
    });
  }, login);
}

export interface PatientBinding {
  patientId: string;
  patientName: string;
  consentId: string | null;
  language: string | null;
  nextVisit: string | null;
  scheduledAt: string | null;
  cycleNumber: number | null;
  regimen: string | null;
  practitionerName: string;
}
