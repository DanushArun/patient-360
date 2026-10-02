const DOCUMENT_STATES = new Map([
  ["received", "Received"],
  ["present", "Present"],
  ["explicitly_negative", "Explicitly negative"],
  ["pending", "Pending"],
  ["not_received", "Not received"],
  ["conflicting", "Conflicting"],
  ["unreadable", "Unreadable"],
  ["superseded", "Superseded"],
]);

/** @param {unknown} state @returns {string} */
export function documentStateLabel(state) {
  return DOCUMENT_STATES.get(String(state)) ?? "State unavailable";
}

/** @param {Record<string, unknown>[]} documents @param {Record<string, unknown>[]} expectedDocuments
 *  @returns {Record<string, unknown>[]}
 */
export function documentLibraryRows(documents, expectedDocuments) {
  const received = documents.map((document) => ({
    id: `document:${String(document.doc_id)}`,
    kind: "received",
    document,
    title: String(document.doc_type ?? "Document type unavailable"),
    state: documentStateLabel(document.missingness_state ?? document.evidence_state ?? "received"),
    stateCode: document.missingness_state ?? document.evidence_state ?? "received",
    verification: assertionSummary(document),
    verificationObservedAt: nullableText(document.verification_observed_at),
    sourceFacility: String(document.source_facility ?? "Not returned"),
    ruleId: null,
    reason: null,
  }));
  const expected = expectedDocuments.flatMap(expectedDocumentRow);
  return [...received, ...expected];
}

/** @param {Record<string, unknown>} expected @returns {Record<string, unknown>[]}
 */
function expectedDocumentRow(expected) {
  if (typeof expected.title !== "string" || !expected.rule_id
    || !DOCUMENT_STATES.has(expected.missingness_state)) return [];
  return [{
    id: `expected:${expected.rule_id}`, kind: "expected", document: null,
    title: expected.title, state: documentStateLabel(expected.missingness_state),
    stateCode: expected.missingness_state, verification: "Not applicable",
    verificationObservedAt: null, sourceFacility: "Not returned",
    ruleId: expected.rule_id, reason: expected.reason ?? null,
  }];
}

/** @param {Record<string, unknown>} document @returns {string} */
function assertionSummary(document) {
  const counts = [
    countLabel(document.assertion_count, "assertion"),
    countLabel(document.verified_assertions, "verified"),
    countLabel(document.conflicting_assertions, "conflicting"),
  ].filter(Boolean);
  return counts.length ? counts.join(" · ") : "Not returned";
}

/** @param {unknown} value @param {string} label @returns {string|null} */
function countLabel(value, label) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
  const noun = label === "assertion" && value !== 1 ? "assertions" : label;
  return `${value} ${noun}`;
}

/** @param {unknown} value @returns {string|null} */
function nullableText(value) {
  return typeof value === "string" && value ? value : null;
}

/** @param {string} patientId @param {string} documentId @param {string|null} knownAsOf
 *  @returns {string|null}
 */
export function documentSourceHref(patientId, documentId, knownAsOf) {
  if (!knownAsOf) return null;
  const path = `/patient/${encodeURIComponent(patientId)}/documents/`
    + encodeURIComponent(documentId);
  const query = new URLSearchParams({ page: "0", known_as_of: knownAsOf, return: "documents" });
  return `${path}?${query.toString()}`;
}
