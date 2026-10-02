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

/** @param {unknown} state @returns {string} */
export function factStateLabel(state) {
  return FACT_STATES.get(String(state)) ?? "State unavailable";
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
    return `Lab data ingested through ${timestamp}.`;
  }
  if (facts.as_of_semantics === "current_at_query") {
    return `Current facts read at ${timestamp}; the requested historical cutoff does not apply.`;
  }
  return "Temporal basis unavailable.";
}
