export const MAX_QUESTION_LENGTH = 4000;
export const MAX_REQUEST_BODY_BYTES = 24_000;
const PATIENT_ID = /^[A-Za-z0-9-]{1,80}$/;
const DOCUMENT_ID = /^[A-Za-z0-9-]{1,80}$/;
const FACT_DOMAINS = [
  "demographics", "labs", "coverage", "treatment_plan", "encounters", "identity",
];
const KNOWN_AS_OF = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/**
 * @typedef {"demographics" | "labs" | "coverage" |
 *   "treatment_plan" | "encounters" | "identity"} FactDomain
 */
/**
 * @typedef {{view: "facts", domain: FactDomain, knownAsOf: string | null,
 *   documentId: null} | {view: "documents", domain: null,
 *   knownAsOf: string | null, documentId: string | null} | {view: "coverage_comparison",
 *   domain: null, knownAsOf: string | null, documentId: null}} WorkspaceQuery
 */

const ERROR_CATEGORIES = {
  invalid_argument: "invalid",
  invalid_origin: "invalid",
  question_too_long: "invalid",
  request_too_large: "invalid",
  no_patient_access: "access",
  access_withdrawn: "access",
  access_scope_changed: "access",
  binding_mismatch: "access",
  consent_not_valid: "access",
  no_patient_bound: "access",
  gate_not_found: "conflict",
  gate_not_actionable: "conflict",
  stale_task: "conflict",
  task_transition_requires_review: "conflict",
  no_encounter: "conflict",
  reference_scope_unavailable: "conflict",
  invalid_transition: "conflict",
  owner_not_authorized: "conflict",
  task_update_unavailable: "unavailable",
  write_receipt_missing: "uncertain",
  write_readback_unavailable: "uncertain",
  write_readback_unconfirmed: "uncertain",
  snowflake_access_disabled: "configuration",
  action_unavailable: "unavailable",
  agent_unreachable: "unavailable",
  timeline_unavailable: "unavailable",
  schemes_unavailable: "unavailable",
  evidence_history_unavailable: "unavailable",
  packet_unavailable: "unavailable",
  task_history_unavailable: "unavailable",
  clinical_referral_only: "conflict",
  treating_practitioner_unavailable: "conflict",
  readiness_unavailable: "unavailable",
  readiness_refresh_unavailable: "unavailable",
  workspace_data_unavailable: "unavailable",
  record_service_unavailable: "unavailable",
  service_unavailable: "unavailable",
  snowflake_configuration_missing: "configuration",
  snowflake_account_mismatch: "configuration",
};

/**
 * @param {unknown} body
 * @returns {{patientId: string, question: string,
 *   sourceScope: "patient" | "reference"} | null}
 */
export function validateAskBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const { patientId, question, sourceScope = "patient" } = body;
  if (typeof patientId !== "string" || !PATIENT_ID.test(patientId)) return null;
  if (typeof question !== "string" || !question.trim() || question.length > MAX_QUESTION_LENGTH) {
    return null;
  }
  if (sourceScope !== "patient" && sourceScope !== "reference") return null;
  return { patientId, question: question.trim(), sourceScope };
}

/**
 * @param {unknown} body
 * @returns {{patientId: string, ruleId: string,
 *   action: "request_document" | "escalate", requestId?: string} | null}
 */
export function validateReviewTaskBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const { patientId, ruleId, action, requestId } = body;
  if (typeof patientId !== "string" || !PATIENT_ID.test(patientId)) return null;
  if (typeof ruleId !== "string" || !/^[A-Z0-9-]{1,80}$/.test(ruleId)) return null;
  if (action !== "request_document" && action !== "escalate") return null;
  if (requestId !== undefined
    && (typeof requestId !== "string" || !/^[A-Za-z0-9-]{8,80}$/.test(requestId))) return null;
  return requestId === undefined ? { patientId, ruleId, action }
    : { patientId, ruleId, action, requestId };
}

/** Malformed patient ids never reach Snowflake. A well-formed id that is unknown or not
 * authorised deliberately renders the same error state (no existence oracle, R5).
 * @param {unknown} id @returns {boolean} */
export function isValidPatientId(id) {
  return typeof id === "string" && PATIENT_ID.test(id);
}

/** @param {URLSearchParams} params @returns {WorkspaceQuery | null} */
export function validateWorkspaceQuery(params) {
  const view = params.get("view");
  const domain = params.get("domain");
  const knownAsOf = params.get("known_as_of");
  const documentId = params.get("documentId");
  if (knownAsOf !== null && !KNOWN_AS_OF.test(knownAsOf)) return null;
  if (documentId !== null && !DOCUMENT_ID.test(documentId)) return null;
  if (view === "facts" && domain && FACT_DOMAINS.includes(domain) && documentId === null) {
    return { view, domain, knownAsOf, documentId: null };
  }
  if (view === "documents" && domain === null) {
    return { view, domain: null, knownAsOf, documentId };
  }
  if (view === "coverage_comparison" && domain === null && documentId === null) {
    return { view, domain: null, knownAsOf, documentId: null };
  }
  return null;
}

/** @param {Request} request */
export function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const requestUrl = new URL(request.url);
    const supplied = new URL(origin);
    if (origin !== supplied.origin) return false;
    const host = request.headers.get("host");
    const authority = host ? new URL(`${requestUrl.protocol}//${host}`) : requestUrl;
    if (authority.username || authority.password) return false;
    return isTrustedAuthority(authority, supplied);
  } catch {
    return false;
  }
}

/** @param {URL} authority @param {URL} supplied */
function isTrustedAuthority(authority, supplied) {
  const configured = (process.env.SAARTHI_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (configured.some((value) => matchesConfiguredOrigin(value, authority, supplied))) return true;
  return authority.protocol === "http:" && supplied.origin === authority.origin
    && ["localhost", "127.0.0.1", "[::1]"].includes(authority.hostname);
}

/** @param {string} value @param {URL} authority @param {URL} supplied */
function matchesConfiguredOrigin(value, authority, supplied) {
  try {
    const trusted = new URL(value);
    return trusted.origin === supplied.origin && trusted.host === authority.host;
  } catch {
    return false;
  }
}

/** @param {Request} request @returns {Promise<unknown>} */
export async function readJsonBody(request) {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > MAX_REQUEST_BODY_BYTES) {
    throw new Error("request_too_large");
  }
  if (!request.body) throw new Error("invalid_argument");
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REQUEST_BODY_BYTES) {
        await reader.cancel();
        throw new Error("request_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("invalid_argument");
    throw error;
  }
}

/** @param {unknown} error @param {string} [fallback] */
export function apiError(error, fallback = "service_unavailable") {
  const message = getSafeErrorCode(error);
  const candidate = message.startsWith("bind failed: ")
    ? message.slice("bind failed: ".length)
    : message;
  const code = Object.hasOwn(ERROR_CATEGORIES, candidate) ? candidate : fallback;
  const category = ERROR_CATEGORIES[code] ?? "unavailable";
  return { error: code, category, purge_patient_state: category === "access" };
}

/** @param {unknown} error */
function getSafeErrorCode(error) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "error" in error) {
    const value = /** @type {{ error?: unknown }} */ (error).error;
    return typeof value === "string" ? value : "";
  }
  return typeof error === "string" ? error : "";
}

/** @param {string} code @returns {number} */
export function apiErrorStatus(code) {
  const category = ERROR_CATEGORIES[code];
  if (code === "request_too_large") return 413;
  if (category === "invalid") return code === "invalid_origin" ? 403 : 400;
  if (category === "access") return 403;
  if (category === "conflict") return 409;
  if (category === "configuration") return 503;
  if (category === "uncertain") return code === "write_readback_unconfirmed" ? 409 : 503;
  return 502;
}
