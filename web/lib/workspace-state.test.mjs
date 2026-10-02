import assert from "node:assert/strict";
import test from "node:test";

const workspace = await import("./workspace-state.mjs").catch(() => ({}));

test("resolves only supported patient sections and defaults unknown views", () => {
  assert.equal(typeof workspace.resolvePatientSection, "function");
  assert.equal(workspace.resolvePatientSection("Coverage"), "Coverage");
  assert.equal(workspace.resolvePatientSection("clinical"), "Overview");
});

test("rejects a response from an older patient request", () => {
  assert.equal(typeof workspace.isLatestPatientResponse, "function");
  assert.equal(workspace.isLatestPatientResponse("PAT-2", "PAT-2", 3, 4), false);
  assert.equal(workspace.isLatestPatientResponse("PAT-2", "PAT-2", 4, 4), true);
});

test("preserves distinct rule outcome wording", () => {
  assert.equal(typeof workspace.ruleOutcomeLabel, "function");
  assert.equal(workspace.ruleOutcomeLabel("not_evaluated"), "Not evaluated");
  assert.equal(workspace.ruleOutcomeLabel("conflicting"), "Conflicting");
});

test("groups census visits into mutually exclusive review states", () => {
  assert.equal(typeof workspace.groupWorklistByState, "function");
  const groups = workspace.groupWorklistByState([
    { status: "blocked" },
    { status: "conflict" },
    { status: "waiting" },
    { status: "advisory" },
    { status: "ready" },
  ]);
  assert.deepEqual(groups.map((group) => group.rows.length), [2, 1, 1, 1]);
  assert.equal(groups.flatMap((group) => group.rows).length, 5);
});

test("recognizes an explicit patient access purge response", () => {
  assert.equal(typeof workspace.purgesPatientState, "function");
  assert.equal(workspace.purgesPatientState({ error: "access_withdrawn", purge_patient_state: true }), true);
  assert.equal(workspace.purgesPatientState({ error: "service_unavailable" }), false);
});

test("test_section_when_comparison_hash_returns_restores_coverage_comparison", () => {
  assert.equal(workspace.resolvePatientSection("coverage-comparison"), "Coverage comparison");
});
