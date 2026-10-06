import { formatClock } from './display-format.mjs';
/** @param {Record<string, unknown>[]} rows @returns {Record<string, unknown>[]} */
export function normalizeWorkspaceRows(rows) {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.toLowerCase(), value]),
  ));
}

/** @param {{as_of_semantics?: string, known_as_of?: string | null}} facts
 * @returns {string}
 */
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
