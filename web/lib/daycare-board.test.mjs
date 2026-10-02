import test from "node:test";
import assert from "node:assert/strict";
import { filterDayCareVisits, getAvailableVisitDates } from "./daycare-board.mjs";

const groups = [
  { day: "2026-10-03", chairs: [
    { name: "Fatima Begum", patientId: "PAT-04", status: "blocked",
      headline: "Platelet check below rule threshold" },
    { name: "Gopal Das", patientId: "PAT-08", status: "conflict" },
  ] },
  { day: "2026-10-04", chairs: [
    { name: "Anjali Nair", patientId: "PAT-09", status: "waiting" },
  ] },
];

test("selected visit date displays only visits returned for that date", () => {
  const rows = filterDayCareVisits(groups, "2026-10-03", "");
  assert.deepEqual(rows.map((row) => row.patientId), ["PAT-04", "PAT-08"]);
});

test("next seven days searches across the returned visit window", () => {
  const rows = filterDayCareVisits(groups, "all", "anjali");
  assert.deepEqual(rows.map((row) => row.patientId), ["PAT-09"]);
});

test("next seven days keeps returned visits in calendar order", () => {
  const rows = filterDayCareVisits([...groups].reverse(), "all", "");
  assert.deepEqual(rows.map((row) => row.patientId), ["PAT-04", "PAT-08", "PAT-09"]);
});

test("available date choices come only from returned visits", () => {
  assert.deepEqual(getAvailableVisitDates([...groups].reverse()), [
    "2026-10-03", "2026-10-04",
  ]);
});

test("search matches the returned record issue summary", () => {
  const rows = filterDayCareVisits(groups, "all", "platelet check");
  assert.deepEqual(rows.map((row) => row.patientId), ["PAT-04"]);
});
