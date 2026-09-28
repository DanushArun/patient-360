import snowflake from "snowflake-sdk";
import { readFileSync } from "fs";

// Credentials from environment variables (web/.env.local, gitignored by Next.js).
// Each developer creates their own .env.local — no more swapping commented lines.
//
//   SNOWFLAKE_ACCOUNT=IFTDBGM-EA72552
//   SNOWFLAKE_USER=DAKSHA
//   SNOWFLAKE_PRIVATE_KEY_PATH=/Users/mac/.snowflake/keys/daksha_snow_rsa.p8
//   SNOWFLAKE_WAREHOUSE=SAARTHI_AI_WH
//
// Defaults are Danush's (repo owner) so CI and his machine work without .env.local.
const ACCOUNT = process.env.SNOWFLAKE_ACCOUNT ?? "KGTPGHJ-YJ28449";
const USER = process.env.SNOWFLAKE_USER ?? "DANUSH";
const PRIVATE_KEY_PATH = process.env.SNOWFLAKE_PRIVATE_KEY_PATH ?? "/Users/danusharun/.snowflake/keys/saarthi_rsa_key.p8";
const WAREHOUSE = process.env.SNOWFLAKE_WAREHOUSE ?? "SAARTHI_AI_WH";


// NOT cached as a module singleton, deliberately. BIND_PATIENT and every agent
// tool resolve their subject from PATIENT_BINDING keyed on CURRENT_SESSION() -
// exactly the same server-side design as the Streamlit app (frontend/streamlit_app.py).
// A cached connection shared across every Next.js request means every visitor
// shares ONE CURRENT_SESSION(), so whoever binds last determines what every
// other request sees - the identical cross-user leak found and fixed in the
// Streamlit build. Key-pair (JWT) auth has no browser round-trip, so a fresh
// connection per request is cheap and safe, unlike OAuth.
function openConnection(): Promise<snowflake.Connection> {
  const privateKey = readFileSync(PRIVATE_KEY_PATH, "utf8");
  const conn = snowflake.createConnection({
    account: ACCOUNT,
    username: USER,
    authenticator: "SNOWFLAKE_JWT",
    privateKey,
    role: "SAARTHI_APP",
    warehouse: WAREHOUSE,
  });
  return new Promise((resolve, reject) => {
    conn.connect((err, c) => (err ? reject(err) : resolve(c)));
  });
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
    await execOn(conn, "USE SECONDARY ROLES NONE");
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
    await run("USE SECONDARY ROLES NONE");
    const bindRows = await run("CALL SAARTHI.OPERATIONAL.BIND_PATIENT(?)", [patientId]);
    const bindCell = Object.values(bindRows[0] ?? {})[0];
    const bindResult = typeof bindCell === "string" ? JSON.parse(bindCell) : bindCell;
    if (!bindResult || typeof bindResult !== "object") throw new Error("binding_unavailable");
    if (bindResult.error) throw new Error(`bind failed: ${bindResult.error}`);
    return await fn(run);
  } finally {
    try {
      await run(
        "UPDATE SAARTHI.GOVERNANCE.PATIENT_BINDING SET released_at = CURRENT_TIMESTAMP() " +
          "WHERE session_id = CURRENT_SESSION() AND released_at IS NULL"
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
    const rows = await run(
      `WITH next_visit AS (
         SELECT patient_id, cycle_number,
                TO_VARCHAR(scheduled_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS scheduled_at
           FROM SAARTHI.CORE.ENCOUNTER
          WHERE encounter_type = 'daycare' AND scheduled_time >= CURRENT_DATE()
          QUALIFY ROW_NUMBER() OVER (PARTITION BY patient_id ORDER BY scheduled_time) = 1
       ), latest_plan AS (
         SELECT patient_id, regimen_display
           FROM SAARTHI.CORE.TREATMENT_PLAN
          QUALIFY ROW_NUMBER() OVER (
            PARTITION BY patient_id ORDER BY version DESC, decided_at DESC) = 1
       )
       SELECT p.name, p.primary_language, nv.scheduled_at, nv.cycle_number,
              lp.regimen_display,
              (SELECT b.consent_id FROM SAARTHI.GOVERNANCE.PATIENT_BINDING b
                WHERE b.session_id = CURRENT_SESSION() AND b.released_at IS NULL
                ORDER BY b.bound_at DESC LIMIT 1) AS consent_id,
              pr.name AS practitioner_name
         FROM SAARTHI.CORE.PATIENT p
         JOIN SAARTHI.GOVERNANCE.PRACTITIONER pr
           ON UPPER(pr.snowflake_user) = UPPER(CURRENT_USER()) AND pr.active = TRUE
         LEFT JOIN next_visit nv ON nv.patient_id = p.patient_id
         LEFT JOIN latest_plan lp ON lp.patient_id = p.patient_id
        WHERE p.patient_id = ?`,
      [patientId]
    );
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
