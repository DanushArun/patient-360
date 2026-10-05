import assert from "node:assert/strict";
import test from "node:test";
import { answerCohort, matchCohortIntent } from "./copilot-cohort.mjs";

const chair = (patientId, status, headlineRule) => ({ patientId, name: patientId, status,
  headline: `${headlineRule} issue`, headlineRule, otherIssues: 0, scheduled: "2026-10-06T09:30:00" });
const census = [
  chair("PAT-DC-04", "blocked", "CLIN-PLT-001"),
  chair("PAT-DC-05", "blocked", "CLIN-ANC-001"),
  chair("PAT-DC-07", "conflict", "COV-AUTH-001"),
  chair("PAT-DC-08", "waiting", "CLIN-ANC-001"),
  chair("PAT-DC-09", "advisory", "ENDO-HBA1C-001"),
  chair("PAT-DC-01", "ready", null),
];

test("blocked question lists only blocked visits", () => {
  const answer = answerCohort(census, matchCohortIntent("Who is blocked today?"));
  assert.deepEqual(answer.rows.map((row) => row.patientId), ["PAT-DC-04", "PAT-DC-05"]);
  assert.equal(answer.title, "Blocked");
  assert.equal(answer.basis, null);
});

test("topic question filters on the main issue and says so", () => {
  const answer = answerCohort(census, matchCohortIntent("Which patients have pre-auth problems?"));
  assert.deepEqual(answer.rows.map((row) => row.patientId), ["PAT-DC-07"]);
  assert.match(answer.basis, /main record issue/);
});

test("status and topic combine", () => {
  const intent = matchCohortIntent("Who is blocked on ANC?");
  assert.deepEqual(answerCohort(census, intent).rows.map((row) => row.patientId), ["PAT-DC-05"]);
});

test("waiting means not received, never negative", () => {
  const answer = answerCohort(census, matchCohortIntent("What evidence is still missing?"));
  assert.deepEqual(answer.rows.map((row) => row.patientId), ["PAT-DC-08"]);
  assert.equal(answer.title, "Waiting on evidence");
});

test("overview returns every visit with counts", () => {
  const answer = answerCohort(census, matchCohortIntent("Give me a summary of today"));
  assert.equal(answer.rows.length, 6);
  assert.deepEqual(answer.counts, { blocked: 2, conflict: 1, waiting: 1, advisory: 1, ready: 1 });
});

test("unrecognised question returns no rows rather than guessing", () => {
  const answer = answerCohort(census, matchCohortIntent("Tell me a joke"));
  assert.equal(answer.title, null);
  assert.deepEqual(answer.rows, []);
});
