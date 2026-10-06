import snowflake from "snowflake-sdk";
import { snowflakeDriverConfig } from "./snowflake-driver-config.mjs";
import { readFileSync } from "fs";
import { snowflakeConfig } from "./snowflake-config.mjs";
import { isValidPatientId } from "./api-contracts.mjs";

snowflake.configure(snowflakeDriverConfig);

// NOT cached as a shared module singleton, deliberately. Connections ARE pooled, but each
// lease is exclusive to one request, and a connection returns to the pool only after
// RELEASE_PATIENT_BINDING succeeded and the work finished cleanly (otherwise it is destroyed).
// Opening + verifying a session costs ~2s; the exclusive lease keeps the one-binding-per-
// session guarantee below intact. BIND_PATIENT and every agent
// tool resolve their subject from PATIENT_BINDING keyed on CURRENT_SESSION() -
// exactly the same server-side design as the Streamlit app (frontend/streamlit_app.py).
// A cached connection shared across every Next.js request means every visitor
// shares ONE CURRENT_SESSION(), so whoever binds last determines what every
// other request sees - the identical cross-user leak found and fixed in the
// Streamlit build. Key-pair (JWT) auth has no browser round-trip, so a fresh
// connection per request is cheap and safe, unlike OAuth.
async function openConnection(): Promise<snowflake.Connection> {
  const config = snowflakeConfig();
  const auth = config.authenticator === "PROGRAMMATIC_ACCESS_TOKEN"
    ? {
        authenticator: "PROGRAMMATIC_ACCESS_TOKEN" as const,
        token: readFileSync(config.patPath!, "utf8").trim(),
      }
    : {
        authenticator: "SNOWFLAKE_JWT" as const,
        privateKey: config.privateKey ?? readFileSync(config.privateKeyPath!, "utf8"),
      };
  const conn = snowflake.createConnection({
    account: config.account,
    username: config.username,
    ...auth,
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
    try {
      await execOn(conn, "USE SECONDARY ROLES NONE");
    } catch (error) {
      // Restricted PAT sessions reject role changes with 003107. That error
      // alone does not prove safe privileges; verify the actual session below.
      if (!(error && typeof error === "object" && "code" in error
          && Number(error.code) === 3107)) throw error;
    }
    const identity = await execOn<{ APP_ROLE: string; SECONDARY_ROLES: string }>(conn,
      "SELECT CURRENT_ROLE() AS APP_ROLE, CURRENT_SECONDARY_ROLES() AS SECONDARY_ROLES");
    let secondary;
    try {
      secondary = JSON.parse(identity[0]?.SECONDARY_ROLES);
    } catch {
      throw new Error("snowflake_session_scope_unverified");
    }
    if (identity.length !== 1 || identity[0]?.APP_ROLE !== "SAARTHI_APP"
        || !secondary || secondary.roles !== ""
        || !["", "NONE"].includes(secondary.value)) {
      throw new Error("snowflake_session_scope_unverified");
    }
    await execOn(conn,
      "ALTER SESSION SET TIMEZONE = 'UTC', STATEMENT_TIMEOUT_IN_SECONDS = 120, " +
      "STATEMENT_QUEUED_TIMEOUT_IN_SECONDS = 30, QUERY_TAG = 'saarthi_web_prototype'"
    );
    return conn;
  } catch (error) {
    await destroyConnection(conn);
    throw error;
  }
}

const IDLE_MAX = 8;
const IDLE_TTL_MS = 4 * 60_000;
type IdleConnection = { conn: snowflake.Connection; at: number };
// globalThis: Next bundles each route separately, and each bundle would otherwise get its own pool.
const pool = ((globalThis as { __saarthiPool?: IdleConnection[] }).__saarthiPool ??= []);

async function acquireConnection(): Promise<snowflake.Connection> {
  while (pool.length) {
    const idle = pool.pop()!;
    const up = typeof idle.conn.isUp !== "function" || idle.conn.isUp();
    if (up && Date.now() - idle.at < IDLE_TTL_MS) return idle.conn;
    void destroyConnection(idle.conn).catch(() => undefined);
  }
  return openConnection();
}

/** Return a verified, binding-free connection to the pool, or close it when the pool is full. */
function releaseConnection(conn: snowflake.Connection): Promise<void> {
  if (pool.length >= IDLE_MAX) return destroyConnection(conn);
  pool.push({ conn, at: Date.now() });
  return Promise.resolve();
}

/** Close every pooled connection (shutdown and tests). */
export async function closeIdleConnections(): Promise<void> {
  const idle = pool.splice(0);
  await Promise.all(idle.map(({ conn }) => destroyConnection(conn)));
}

function destroyConnection(conn: snowflake.Connection): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.destroy((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

/** One-off query: opens, runs, closes. Use for stateless reads (census, etc). */
export async function query<T = Record<string, unknown>>(
  sqlText: string,
  binds: (string | number | null)[] = []
): Promise<T[]> {
  const conn = await acquireConnection();
  try {
    const rows = await execOn<T>(conn, sqlText, binds);
    await releaseConnection(conn);
    return rows;
  } catch (error) {
    await destroyConnection(conn).catch(() => undefined);
    throw error;
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
  fn: (run: (sql: string, binds?: (string | number | null)[]) => Promise<Record<string, unknown>[]>) => Promise<T>
): Promise<T> {
  const conn = await acquireConnection();
  try {
    const result = await fn((sql, binds = []) => execOn(conn, sql, binds));
    await releaseConnection(conn);
    return result;
  } catch (error) {
    await destroyConnection(conn).catch(() => undefined);
    throw error;
  }
}

/**
 * A session for one request that needs binding: BIND_PATIENT then one or more
 * agent calls that must resolve to that same binding server-side. Always
 * releases the binding and closes the connection when done, so a crashed
 * request can't leave a binding (or a Snowflake session) dangling.
 */
type PatientQuery = (
  sql: string, binds?: (string | number | null)[]
) => Promise<Record<string, unknown>[]>;

async function verifyPatientAccess(run: PatientQuery): Promise<string> {
  const rows = await run("CALL SAARTHI.OPERATIONAL.VALIDATE_ANSWER(ARRAY_CONSTRUCT(),NULL)");
  const cell = Object.values(rows[0] ?? {})[0];
  const checked = typeof cell === "string" ? JSON.parse(cell) : cell;
  if (!checked || typeof checked !== "object") throw new Error("consent_check_unavailable");
  if (checked.error) {
    const denied = ["access_withdrawn", "no_patient_bound", "no_patient_access"];
    throw new Error(denied.includes(checked.error) ? checked.error : "consent_check_unavailable");
  }
  if (rows.length !== 1 || typeof checked.access_scope !== 'string'
      || !/^[a-f0-9]{64}$/.test(checked.access_scope) || typeof checked.known_as_of !== "string"
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(checked.known_as_of)
      || !Number.isFinite(Date.parse(checked.known_as_of + "Z"))
      || !Array.isArray(checked.claims) || checked.claims.length !== 0) {
    throw new Error("consent_check_unavailable");
  }
  return checked.access_scope;
}

/** Re-checks patient access inside a session; throws if it changed since the session began.
 * A caller that publishes part of its result early must pass a checkpoint first. */
export type AccessCheckpoint = () => Promise<void>;

export async function withPatientSession<T>(
  patientId: string,
  fn: (run: PatientQuery, checkpoint: AccessCheckpoint) => Promise<T>
): Promise<T> {
  // Malformed ids are a client error and never reach Snowflake (F-04/F-05).
  if (!isValidPatientId(patientId)) throw new Error("invalid_argument");
  const conn = await acquireConnection();
  const run = (sql: string, binds: (string | number | null)[] = []) => execOn(conn, sql, binds);
  let clean = false;
  try {
    const bindRows = await run("CALL SAARTHI.OPERATIONAL.BIND_PATIENT(?)", [patientId]);
    const bindCell = Object.values(bindRows[0] ?? {})[0];
    const bindResult = typeof bindCell === "string" ? JSON.parse(bindCell) : bindCell;
    if (!bindResult || typeof bindResult !== "object") throw new Error("binding_unavailable");
    if (bindResult.error) throw new Error(`bind failed: ${bindResult.error}`);
    const accessScope = await verifyPatientAccess(run);
    const checkpoint: AccessCheckpoint = async () => {
      if (await verifyPatientAccess(run) !== accessScope) throw new Error("access_scope_changed");
    };
    const result = await fn(run, checkpoint);
    if (await verifyPatientAccess(run) !== accessScope) {
      throw new Error("access_scope_changed");
    }
    clean = true;
    return result;
  } finally {
    let released = false;
    try {
      await run(
        "CALL SAARTHI.OPERATIONAL.RELEASE_PATIENT_BINDING()"
      );
      released = true;
    } finally {
      // Only a clean request whose binding was released goes back to the pool.
      await (clean && released ? releaseConnection(conn) : destroyConnection(conn));
    }
  }
}

export async function withPatientSessionAndContext<T>(
  patientId: string,
  fn: (run: (sql: string, binds?: (string | number | null)[]) => Promise<Record<string, unknown>[]>,
    context: PatientBinding, checkpoint: AccessCheckpoint) => Promise<T>
): Promise<T> {
  return withPatientSession(patientId, async (run, checkpoint) => {
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
      treatingPractitionerName: typeof rows[0].TREATING_PRACTITIONER_NAME === "string"
        ? rows[0].TREATING_PRACTITIONER_NAME : null,
    }, checkpoint);
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
  treatingPractitionerName: string | null;
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
