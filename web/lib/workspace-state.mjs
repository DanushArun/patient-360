const PATIENT_SECTIONS = new Set([
  "Overview",
  "Facts",
  "Timeline",
  "Documents",
  "Coverage",
  "Review",
  "Family",
]);

const RULE_OUTCOMES = {
  pass: "Pass",
  fail: "Fail",
  not_evaluated: "Not evaluated",
  conflicting: "Conflicting",
};

/** @param {string | null} value @returns {string} */
export function resolvePatientSection(value) {
  return PATIENT_SECTIONS.has(value ?? "") ? value : "Overview";
}

/**
 * @param {string} requestPatientId
 * @param {string} activePatientId
 * @param {number} requestVersion
 * @param {number} latestVersion
 * @returns {boolean}
 */
export function isLatestPatientResponse(
  requestPatientId, activePatientId, requestVersion, latestVersion,
) {
  return requestPatientId === activePatientId && requestVersion === latestVersion;
}

/** @param {string} outcome @returns {string} */
export function ruleOutcomeLabel(outcome) {
  return RULE_OUTCOMES[outcome] ?? "Outcome unavailable";
}

const WORKLIST_GROUPS = [
  { key: "review", label: "Needs review", statuses: ["blocked", "conflict"] },
  { key: "waiting", label: "Waiting on evidence", statuses: ["waiting"] },
  { key: "advisory", label: "Advisory", statuses: ["advisory"] },
  { key: "met", label: "Checks met", statuses: ["ready"] },
];

/** @param {{ status: string }[]} rows @returns {object[]} */
export function groupWorklistByState(rows) {
  return WORKLIST_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    rows: rows.filter((row) => group.statuses.includes(row.status)),
  }));
}

export const PATIENT_ACCESS_EVENT = "saarthi:patient-access-withdrawn";

/** @param {unknown} payload @returns {boolean} */
export function purgesPatientState(payload) {
  return Boolean(payload && typeof payload === "object" && "purge_patient_state" in payload
    && payload.purge_patient_state === true);
}

/** @param {string} patientId @returns {void} */
export function announcePatientAccessWithdrawn(patientId) {
  window.dispatchEvent(new CustomEvent(PATIENT_ACCESS_EVENT, { detail: { patientId } }));
}
