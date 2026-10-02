import snowflake from "snowflake-sdk";
import { snowflakeDriverConfig } from "./snowflake-driver-config.mjs";
import { readFileSync } from "fs";
import { snowflakeConfig } from "./snowflake-config.mjs";

snowflake.configure(snowflakeDriverConfig);

// NOT cached as a module singleton, deliberately. BIND_PATIENT and every agent
// tool resolve their subject from PATIENT_BINDING keyed on CURRENT_SESSION() -
// exactly the same server-side design as the Streamlit app (frontend/streamlit_app.py).
// A cached connection shared across every Next.js request means every visitor
// shares ONE CURRENT_SESSION(), so whoever binds last determines what every
// other request sees - the identical cross-user leak found and fixed in the
// Streamlit build. Key-pair (JWT) auth has no browser round-trip, so a fresh
// connection per request is cheap and safe, unlike OAuth.
async function openConnection(): Promise<snowflake.Connection> {
  const config = snowflakeConfig();
  const privateKey = readFileSync(config.privateKeyPath, "utf8");
  const conn = snowflake.createConnection({
    account: config.account,
    username: config.username,
    authenticator: "SNOWFLAKE_JWT",
    privateKey,
    role: config.role,
    warehouse: config.warehouse,
  });
  await new Promise<void>((resolve, reject) => {
    conn.connect((err) => {
      if (err) conn.destroy(() => reject(err));
      else resolve();
    });
  });
  try {
    await execOn(conn, "USE SECONDARY ROLES NONE");
    // Per-statement protection, not an account dollar cap. Preserve fresh
    // patient-bound sessions; never share connections to reduce cost.
    await execOn(conn,
      "ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = 120, " +
      "STATEMENT_QUEUED_TIMEOUT_IN_SECONDS = 30, QUERY_TAG = 'saarthi_web_prototype'"
    );
    return conn;
  } catch (error) {
    destroyConnection(conn);
    throw error;
  }
}

function destroyConnection(conn: snowflake.Connection) {
  conn.destroy(() => {});
}

/** One-off query: opens, runs, closes. Use for stateless reads (census, etc). */
export async function query<T = Record<string, unknown>>(
  sqlText: string,
  binds: (string | number | null)[] = []
): Promise<T[]> {
  const conn = await openConnection();
  try {
    return await execOn<T>(conn, sqlText, binds);
  } finally {
    destroyConnection(conn);
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
      complete: (err, statement, rows) => {
        if (err) return reject(err);
        const result = (rows ?? []) as T[];
        Object.defineProperty(result, "query_id", { value: statement.getStatementId() });
        resolve(result);
      },
    });
  });
}

/** Bounded stateless reads share one connection, never a patient binding. */
export async function withReadSession<T>(
  fn: (run: (sql: string) => Promise<Record<string, unknown>[]>) => Promise<T>
): Promise<T> {
  const conn = await openConnection();
  try {
    return await fn((sql) => execOn(conn, sql));
  } finally {
    destroyConnection(conn);
  }
}

/**
 * A session for one request that needs binding: BIND_PATIENT then one or more
 * agent calls that must resolve to that same binding server-side. Always
 * releases the binding and closes the connection when done, so a crashed
 * request can't leave a binding (or a Snowflake session) dangling.
 */
export async function withPatientSession<T>(
  patientId: string,
  fn: (run: (sql: string, binds?: (string | number | null)[]) => Promise<Record<string, unknown>[]>) => Promise<T>
): Promise<T> {
  const conn = await openConnection();
  const run = (sql: string, binds: (string | number | null)[] = []) => execOn(conn, sql, binds);
  try {
    const bindRows = await run("CALL SAARTHI.OPERATIONAL.BIND_PATIENT(?)", [patientId]);
    const bindCell = Object.values(bindRows[0] ?? {})[0];
    const bindResult = typeof bindCell === "string" ? JSON.parse(bindCell) : bindCell;
    if (!bindResult || typeof bindResult !== "object") throw new Error("binding_unavailable");
    if (bindResult.error) throw new Error(`bind failed: ${bindResult.error}`);
    return await fn(run);
  } finally {
    try {
      await run(
        "CALL SAARTHI.OPERATIONAL.RELEASE_PATIENT_BINDING()"
      );
    } finally {
      destroyConnection(conn);
    }
  }
}

export async function withPatientSessionAndContext<T>(
  patientId: string,
  fn: (run: (sql: string, binds?: (string | number | null)[]) => Promise<Record<string, unknown>[]>, context: PatientBinding) => Promise<T>
): Promise<T> {
  return withPatientSession(patientId, async (run) => {
    const rawRows = await run(
      "CALL SAARTHI.OPERATIONAL.GET_WEB_PATIENT_DATA('context',NULL)"
    );
    const rows = procedureRows(rawRows);
    if (!rows[0]) throw new Error("patient_context_unavailable");
    return fn(run, {
      patientId,
      patientName: String(rows[0].NAME ?? patientId),
      consentId: typeof rows[0].CONSENT_ID === "string" ? rows[0].CONSENT_ID : null,
      language: typeof rows[0].PRIMARY_LANGUAGE === "string" ? rows[0].PRIMARY_LANGUAGE : null,
      nextVisit: typeof rows[0].SCHEDULED_AT === "string"
        ? rows[0].SCHEDULED_AT.slice(0, 10) : null,
      scheduledAt: typeof rows[0].SCHEDULED_AT === "string" ? rows[0].SCHEDULED_AT : null,
      cycleNumber: typeof rows[0].CYCLE_NUMBER === "number" ? rows[0].CYCLE_NUMBER : null,
      regimen: typeof rows[0].REGIMEN_DISPLAY === "string" ? rows[0].REGIMEN_DISPLAY : null,
      practitionerName: String(rows[0].PRACTITIONER_NAME ?? ""),
    });
  });
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

/** Typed envelope from the fixed-view owner procedures; never silently return [] on failure. */
export function procedureValue(rows: Record<string, unknown>[]): Record<string, unknown> {
  const cell = Object.values(rows[0] ?? {})[0];
  const value = typeof cell === "string" ? JSON.parse(cell) : cell;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("procedure_unavailable");
  if (value.error) throw new Error(String(value.error));
  return value;
}
export function procedureRows<T = Record<string, unknown>>(rows: Record<string, unknown>[]): T[] {
  const result = procedureValue(rows);
  if (!Array.isArray(result.rows)) throw new Error("procedure_rows_unavailable");
  return result.rows as T[];
}
