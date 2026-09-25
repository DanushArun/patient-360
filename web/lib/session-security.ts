export type ProfessionalLogin = { username: string; password: string };
export const BASIC_CHALLENGE = 'Basic realm="SAARTHI", charset="UTF-8"';

export function unauthorized(): Response {
  return Response.json({ error: "professional_login_required" }, {
    status: 401,
    headers: { "WWW-Authenticate": BASIC_CHALLENGE, "Cache-Control": "no-store" },
  });
}

export function parseBasicAuthorization(value: string | null): ProfessionalLogin | null {
  if (!value) return null;
  const match = /^Basic ([A-Za-z0-9+/]+={0,2})$/i.exec(value.trim());
  if (!match) return null;
  const encoded = match[1];
  const decoded = Buffer.from(encoded, "base64");
  if (decoded.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) return null;
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(decoded);
  } catch {
    return null;
  }
  const separator = text.indexOf(":");
  if (separator <= 0) return null;
  const username = text.slice(0, separator);
  const password = text.slice(separator + 1);
  if (!username.trim() || !password || /[\r\n\0]/.test(username)) return null;
  return { username, password };
}

export interface PatientSessionConnection {
  execute(sql: string, binds?: (string | number | null)[]): Promise<Record<string, unknown>[]>;
  destroy(): Promise<void>;
}

type SessionExecutor = (sql: string, binds?: (string | number | null)[]) => Promise<Record<string, unknown>[]>;

function parseBindResult(rows: Record<string, unknown>[]): Record<string, unknown> {
  const value = Object.values(rows[0] ?? {})[0];
  try {
    const result = typeof value === "string" ? JSON.parse(value) : value;
    if (!result || typeof result !== "object") throw new Error();
    return result as Record<string, unknown>;
  } catch {
    throw new Error("binding_unavailable");
  }
}

/** Runs one patient's work in one authenticated Snowflake session. */
export async function withBoundPatientSession<T>(
  connection: PatientSessionConnection,
  patientId: string,
  fn: (execute: SessionExecutor) => Promise<T>,
): Promise<T> {
  const run: SessionExecutor = (sql, binds = []) => connection.execute(sql, binds);
  let bindAttempted = false;
  try {
    await run("USE SECONDARY ROLES NONE");
    bindAttempted = true;
    const bindResult = parseBindResult(await run("CALL SAARTHI.OPERATIONAL.BIND_PATIENT(?)", [patientId]));
    if (typeof bindResult.error === "string") throw new Error(bindResult.error);
    if (typeof bindResult.binding_id !== "string" || !bindResult.binding_id) throw new Error("binding_unavailable");
    return await fn(run);
  } finally {
    try {
      if (bindAttempted) await run("CALL SAARTHI.OPERATIONAL.RELEASE_PATIENT_BINDING()");
    } finally {
      await connection.destroy();
    }
  }
}
