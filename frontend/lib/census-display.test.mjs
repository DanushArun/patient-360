import test from "node:test";
import assert from "node:assert/strict";
import { classifyGates, describeGates, orderIssues } from "./census-display.mjs";

/** @param {string | null} OUTCOME
 * @param {string | null} [SEVERITY]
 * @param {string | null} [REASON]
 * @returns {import("./census-display.mjs").Gate}
 */
const gate = (OUTCOME, SEVERITY = "advisory", REASON = "DEXA screen is unavailable") => ({
  OUTCOME, SEVERITY, REASON, RULE_ID: "ENDO-DEXA-001",
});

test("test_advisory_not_evaluated_stays_ready_and_keeps_reason", () => {
  const gates = [gate("not_evaluated"), gate("pass", "blocker", "All clear")];
  assert.equal(classifyGates(gates), "ready");
  assert.equal(orderIssues(gates)[0].RULE_ID, "ENDO-DEXA-001");
  assert.equal(describeGates(gates, orderIssues(gates)[0]), "DEXA screen is unavailable");
});

test("test_null_outcome_when_present_waits_and_is_not_all_pass", () => {
  const gates = [gate(null, "blocker", "Outcome missing")];
  assert.equal(classifyGates(gates), "waiting");
  assert.notEqual(describeGates(gates, undefined), "Every applicable rule passes.");
});

test("test_nonpass_unknown_severity_waits", () => {
  assert.equal(classifyGates([gate("fail", null)]), "waiting");
});

test("test_invalid_gate_with_advisory_failure_waits", () => {
  assert.equal(classifyGates([gate("fail"), gate(null, "blocker")]), "waiting");
});

test("test_unknown_outcome_when_present_waits", () => {
  assert.equal(classifyGates([gate("unknown", "blocker")]), "waiting");
});

test("test_only_explicit_passes_get_all_pass_headline", () => {
  assert.equal(describeGates([gate("pass")], undefined), "Every applicable rule passes.");
});
