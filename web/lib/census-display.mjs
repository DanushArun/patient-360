/** @typedef {"blocked" | "conflict" | "waiting" | "advisory" | "ready"} ChairStatus */
/** @typedef {{OUTCOME: string | null, SEVERITY: string | null,
 * REASON: string | null, RULE_ID: string | null}} Gate */

const validOutcomes = new Set(["pass", "fail", "not_evaluated", "conflicting"]);
const validSeverities = new Set(["blocker", "advisory"]);

const issueRank = new Map([
  ["fail:blocker", 0], ["conflicting:blocker", 1], ["conflicting:advisory", 1],
  ["not_evaluated:blocker", 2], ["fail:advisory", 3], ["not_evaluated:advisory", 4],
]);

/** @param {Gate[]} gates @returns {boolean} */
function hasInvalidGate(gates) {
  return gates.some((gate) =>
    !validOutcomes.has(gate.OUTCOME ?? "") ||
    (gate.OUTCOME !== "pass" && !validSeverities.has(gate.SEVERITY ?? ""))
  );
}

/** @param {Gate[]} gates @param {string} outcome @param {string} [severity] */
function has(gates, outcome, severity) {
  return gates.some((gate) => gate.OUTCOME === outcome &&
    (severity === undefined || gate.SEVERITY === severity));
}

/** @param {Gate[]} gates @returns {ChairStatus} */
export function classifyGates(gates) {
  if (has(gates, "fail", "blocker")) return "blocked";
  if (has(gates, "conflicting")) return "conflict";
  if (has(gates, "not_evaluated", "blocker")) return "waiting";
  if (hasInvalidGate(gates)) return "waiting";
  if (has(gates, "fail", "advisory")) return "advisory";
  return "ready";
}

/** @param {Gate[]} gates @returns {Gate[]} */
export function orderIssues(gates) {
  return gates.filter((gate) => issueRank.has(`${gate.OUTCOME}:${gate.SEVERITY}`))
    .sort((a, b) => issueRank.get(`${a.OUTCOME}:${a.SEVERITY}`) -
      issueRank.get(`${b.OUTCOME}:${b.SEVERITY}`) ||
      (a.RULE_ID ?? "").localeCompare(b.RULE_ID ?? ""));
}

/** @param {Gate[]} gates @param {Gate | undefined} head @returns {string} */
export function describeGates(gates, head) {
  if (head) return head.REASON || "An applicable rule needs review.";
  if (!gates.length) return "Readiness has not been computed for this visit yet.";
  if (gates.every((gate) => gate.OUTCOME === "pass")) return "Every applicable rule passes.";
  return "Some applicable rules could not be evaluated.";
}
