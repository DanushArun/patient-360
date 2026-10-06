import { formatClock } from './display-format.mjs';
const FACT_STATES = new Map([
  ["present", "Present"],
  ["explicitly_negative", "Explicitly negative"],
  ["pending", "Pending"],
  ["not_received", "Not received"],
  ["conflicting", "Conflicting"],
  ["unreadable", "Unreadable"],
  ["superseded", "Superseded"],
]);

/** @param {Record<string, unknown>} fact @returns {string} */
export function factValueLabel(fact) {
  if (fact.value_state !== "present") return "—";
  const value = fact.value_text ?? fact.value;
  return value === null || value === undefined ? "—" : String(value);
}

/**
 * Missingness is a type (R3). A procedure that does not return a state (older deployment) must
 * never be shown as "not received": that would contradict a row that carries a value.
 * Present when a value exists; otherwise honestly unknown. Never defaults to a negative or
 * not_received claim.
 * @param {unknown} state @param {unknown} value @param {unknown} valueText @returns {string}
 */
export function deriveValueState(state, value, valueText) {
  if (typeof state === "string" && FACT_STATES.has(state)) return state;
  const hasNumber = typeof value === "number" && Number.isFinite(value);
  const hasText = typeof valueText === "string" && valueText.trim() !== "";
  return hasNumber || hasText ? "present" : "state_unavailable";
}

/** @param {unknown} state @returns {string} */
export function factStateLabel(state) {
  return FACT_STATES.get(String(state)) ?? "State unavailable";
}

/**
 * N4-04: a final event that carries a concept label but no value or text is "present" in SQL
 * (the record exists) but must not render as a bare "Present", which reads as a result. Say so.
 * @param {{value_state?: unknown, value?: unknown, value_text?: unknown}} fact @returns {string}
 */
export function factStateDisplay(fact) {
  const label = factStateLabel(fact.value_state);
  if (fact.value_state !== "present") return label;
  const hasNumber = typeof fact.value === "number" && Number.isFinite(fact.value);
  const hasText = typeof fact.value_text === "string" && fact.value_text.trim() !== "";
  return hasNumber || hasText ? label : `${label} \u00b7 no value recorded`;
}

/** @param {string} patientId @param {string} docId @param {string|null} knownAsOf
 * @returns {string|null}
 */
export function sourceDocumentHref(patientId, docId, knownAsOf) {
  if (!knownAsOf) return null;
  const patient = encodeURIComponent(patientId);
  const document = encodeURIComponent(docId);
  const cutoff = encodeURIComponent(knownAsOf);
  return `/patient/${patient}/documents/${document}?page=0&known_as_of=${cutoff}&return=facts`;
}

/** @param {{as_of_semantics?: string, known_as_of?: string|null}} facts @returns {string} */
export function factsTemporalDescription(facts) {
  const timestamp = facts.known_as_of ?? "time unavailable";
  if (facts.as_of_semantics === "ingested_cutoff") {
    return `Lab data ingested through ${formatClock(timestamp)}.`;
  }
  if (facts.as_of_semantics === "current_at_query") {
    return `Current facts read at ${timestamp}; the requested historical cutoff does not apply.`;
  }
  return "Temporal basis unavailable.";
}
