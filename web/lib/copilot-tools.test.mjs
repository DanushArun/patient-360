import test from "node:test";
import assert from "node:assert/strict";
import { composeRecordAnswer, followOns, gateState, matchRecordTool, readsFor }
  from "./copilot-tools.mjs";
import { readStoredTurns, writeStoredTurns } from "./chat-storage.mjs";

// Shapes copied from live NY64016 reads of PAT-DC-04 (synthetic), trimmed.
const gates = [
  { gate: "clinical", rule_id: "CLIN-ANC-001", rule_version: 1, outcome: "pass",
    reason: "ANC is 2208, meets threshold 1500", severity: "blocker",
    evidence_ids: ["EVT-DC-04-WBC-ANC-DERIVED"], known_as_of: "2026-10-05T07:51:53" },
  { gate: "clinical", rule_id: "CLIN-PLT-001", rule_version: 1, outcome: "fail",
    reason: "PLT is 82000, below threshold 100000", severity: "blocker",
    evidence_ids: ["EVT-DC-04-PLT"], known_as_of: "2026-10-05T07:51:53" },
  { gate: "coverage", rule_id: "COV-AUTH-001", rule_version: 1, outcome: "pass",
    reason: "pre-authorisation approved and current", severity: "blocker",
    evidence_ids: ["PA-DC-04"], known_as_of: "2026-10-05T07:51:53" },
  { gate: "documentation", rule_id: "DOC-HER2-001", rule_version: 1, outcome: "conflicting",
    reason: "IHC and FISH disagree", severity: "blocker", evidence_ids: ["EVT-DC-04-HER2"],
    known_as_of: "2026-10-05T07:51:53" },
  { gate: "safety", rule_id: "ENDO-DEXA-001", rule_version: 2, outcome: "fail",
    reason: "DEXA overdue", severity: "advisory", evidence_ids: [], known_as_of: "2026-10-05T07:51:53" },
];
const patient = { patientName: "Fatima Begum", knownAsOf: "2026-10-05T07:51:53", gates,
  scheduledAt: "2026-10-05T09:30:00", cycleNumber: 3, regimen: "Doxorubicin + cyclophosphamide",
  treatingPractitionerName: "Dr. Test Oncologist", now: "2026-10-06T08:00:00" };
const fact = (concept, value, unit, extra = {}) => ({ concept, value, unit, value_state: "present",
  event_id: `EVT-DC-04-${concept}`, event_time: "2026-10-03T23:03:11", is_derived: false,
  derivation: null, value_text: null, ...extra });
const labs = { known_as_of: "2026-10-06T03:47:58", facts: [fact("ANC", 2208, "/cumm",
  { event_id: "EVT-DC-04-WBC-ANC-DERIVED", is_derived: true,
    derivation: "ANC computed as WBC x neutrophil% / 100" }), fact("PLT", 82000, "/cumm"),
  fact("CREATININE", 0.7, "mg/dL")] };
const documents = { known_as_of: "2026-10-06T03:47:59", expected_documents: [], rows: [
  { doc_id: "DOC-PATH-DC-04", doc_type: "pathology", event_time: "2026-07-22T09:30:00",
    missingness_state: "pending", page_count: 1, source_facility: "Tata Memorial Hospital",
    assertion_count: 2, verified_assertions: 1, conflicting_assertions: 1 },
  { doc_id: "DOC-LAB-DC-04", doc_type: "lab_report", event_time: "2026-10-03T23:03:11",
    missingness_state: "present", page_count: 1, source_facility: "Tata Memorial Hospital",
    assertion_count: 3, verified_assertions: 3, conflicting_assertions: 0 }] };
const match = (question, references) => matchRecordTool(question, references);

test("routes each starter question to the tool that answers it", () => {
  assert.equal(match("What's blocking this visit?").tool, "readiness");
  assert.equal(match("What's missing before the next cycle?").tool, "readiness");
  assert.equal(match("Do any sources disagree?").tool, "conflicts");
  assert.equal(match("Which documents are still missing?").tool, "documents");
  assert.equal(match("Show the latest lab results").tool, "labs");
  assert.equal(match("Is pre-authorisation in place?").tool, "coverage");
  assert.equal(match("Show the recent timeline").tool, "timeline");
  assert.equal(match("Who owns the open review tasks?").tool, "tasks");
  assert.equal(match("When is her next visit?").tool, "visit");
});

test("a named lab value picks the labs tool and the concept", () => {
  const result = match("platelets?");
  assert.equal(result.tool, "labs");
  assert.deepEqual(result.concepts, ["PLT"]);
});

test("attached items choose the tool when the words do not", () => {
  assert.equal(match("explain this", [{ kind: "document", id: "DOC-1" }]).tool, "documents");
  assert.equal(match("explain this", [{ kind: "fact", id: "EVT-1" }]).tool, "labs");
  assert.equal(match("explain this", [{ kind: "check", id: "CLIN-PLT-001" }]).tool, "readiness");
});

test("unrecognised questions are left to the answer gateway", () => {
  assert.equal(match("tell me a joke"), null);
});

test("every tool declares its reads and follow-ons", () => {
  for (const tool of ["readiness", "labs", "documents", "coverage", "timeline", "conflicts",
    "tasks", "visit"]) {
    assert.ok(readsFor(tool).includes("snapshot"));
    assert.equal(followOns(tool).length, 2);
  }
});

test("gate state is a word and a tone, never colour alone", () => {
  assert.deepEqual(gateState({ outcome: "fail", severity: "blocker" }), { state: "Blocked", tone: "critical" });
  assert.deepEqual(gateState({ outcome: "fail", severity: "advisory" }), { state: "Advisory", tone: "warning" });
  assert.deepEqual(gateState({ outcome: "conflicting" }), { state: "Conflict", tone: "critical" });
  assert.deepEqual(gateState({ outcome: "not_evaluated" }), { state: "Not evaluated", tone: "warning" });
});

test("readiness counts open checks from the SQL outcomes and lists them first", () => {
  const card = composeRecordAnswer(match("What's blocking this visit?"), { patient });
  assert.equal(card.summary, "3 of 5 record checks need attention: 1 blocked, 1 conflict, 1 advisory. 2 met.");
  assert.deepEqual(card.items.map((item) => item.ruleId),
    ["CLIN-PLT-001", "DOC-HER2-001", "ENDO-DEXA-001"]);
  assert.equal(card.items[0].value, "PLT is 82000, below threshold 100000");
  assert.ok(card.sources.includes("EVT-DC-04-PLT"));
  assert.equal(card.actions.length, 1);
});

test("a named lab answers with its value, time and the check that flagged it", () => {
  const card = composeRecordAnswer(match("what are her platelets"), { patient, labs });
  assert.equal(card.items.length, 1);
  assert.equal(card.items[0].value, "82,000 /cumm");
  assert.equal(card.items[0].state, "Blocked");
  assert.match(card.summary, /^Platelets: 82,000 \/cumm, taken 3 Oct/);
  assert.match(card.summary, /Flagged by CLIN-PLT-001/);
});

test("a lab that was never received is said to be missing, not normal (R3)", () => {
  const card = composeRecordAnswer(match("what is the LVEF"), { patient, labs });
  assert.equal(card.items.length, 0);
  assert.match(card.summary, /No LVEF result is on record/);
  assert.match(card.summary, /Not received is not the same as normal/);
});

test("derived values carry their formula", () => {
  const card = composeRecordAnswer(match("ANC"), { patient, labs });
  assert.match(card.items[0].note, /ANC computed as WBC x neutrophil% \/ 100/);
});

test("a document with nothing extracted says so", () => {
  const card = composeRecordAnswer(match("which documents do we have"), { patient, documents:
    { ...documents, rows: [{ ...documents.rows[1], assertion_count: 0, verified_assertions: 0 }] } });
  assert.match(card.items[0].note, /^No values extracted yet · 1 page$/);
});

test("documents report verification and conflicts per document", () => {
  const card = composeRecordAnswer(match("which documents do we have"), { patient, documents });
  assert.equal(card.summary, "2 documents on record; no expected document is outstanding.");
  assert.equal(card.items[0].state, "Conflict");
  assert.match(card.items[0].note, /1 value verified of 2 extracted · 1 conflicting value/);
});

test("conflicts gathers rule, document and lab disagreements", () => {
  const card = composeRecordAnswer(match("any conflicts?"), { patient, documents, labs });
  assert.deepEqual(card.items.map((item) => item.id), ["DOC-HER2-001", "DOC-PATH-DC-04"]);
  assert.match(card.summary, /^2 conflicts on record/);
});

test("a visit in the past is never called the next visit", () => {
  const card = composeRecordAnswer(match("When is her next visit?"), { patient });
  assert.equal(card.items[0].label, "Last scheduled visit");
  assert.match(card.summary, /last scheduled day-care visit was .*No later visit is on record\./);
  const upcoming = composeRecordAnswer(match("When is her next visit?"),
    { patient: { ...patient, now: "2026-10-04T08:00:00" } });
  assert.equal(upcoming.items[0].label, "Next visit");
});

test("cards keep at most 8 rows and 2 actions, and say how many were left out", () => {
  const many = Array.from({ length: 11 }, (_, index) => ({ ...gates[1],
    rule_id: `CLIN-X-${String(index).padStart(2, "0")}` }));
  const card = composeRecordAnswer(match("status"), { patient: { ...patient, gates: many } });
  assert.equal(card.items.length, 8);
  assert.equal(card.more, 3);
  assert.ok(card.actions.length <= 2);
});

test("a stored conversation keeps a valid card and drops a malformed one", () => {
  const card = composeRecordAnswer(match("status"), { patient });
  const turn = { id: "t1", role: "assistant", text: card.summary, thinking: "", tools: [],
    suggested: [], gates: [], known_as_of: "2026-10-06T08:00:00", error: null, record: card };
  const store = new Map();
  const storage = { getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value), removeItem: (key) => store.delete(key) };
  writeStoredTurns(storage, "k", [turn]);
  assert.equal(readStoredTurns(storage, "k").turns[0].record.title, "Record checks");
  writeStoredTurns(storage, "k", [{ ...turn, record: { ...card, items: [{ id: 1 }] } }]);
  assert.equal(readStoredTurns(storage, "k").turns.length, 0);
});

// ---- Suggestions must pass the deployed classifier's structure scan (classify_question.sql).
import { readFileSync } from "node:fs";
import { RECORD_TOOL_STARTERS } from "./copilot-tools.mjs";
import { COHORT_STARTERS, matchCohortIntent } from "./copilot-cohort.mjs";

function classifierScans() {
  const sql = readFileSync(new URL("../../backend/sql/procedures/classify_question.sql",
    import.meta.url), "utf8");
  const block = (start, end) => sql.slice(sql.indexOf(start), sql.indexOf(end, sql.indexOf(start)));
  const patterns = (text) => [...text.matchAll(/RLIKE '((?:[^']|'')*)'/g)]
    .map(([, body]) => new RegExp(`^(?:${body.replace(/\\\\/g, "\\").replace(/''/g, "'")})$`, "s"));
  return { classA: patterns(block("-- 1. Keyword scan", "ELSEIF")),
    classB: patterns(block("ELSEIF", "ELSE\n")) };
}

test("every suggested question is Class B by the classifier's own patterns", () => {
  const { classA, classB } = classifierScans();
  assert.ok(classA.length >= 4 && classB.length >= 6, "classifier patterns were found");
  const tools = ["readiness", "labs", "documents", "coverage", "timeline", "conflicts", "tasks", "visit"];
  const suggestions = new Set([...RECORD_TOOL_STARTERS, ...tools.flatMap(followOns)]);
  for (const question of suggestions) {
    const text = question.toLowerCase();
    assert.ok(!classA.some((pattern) => pattern.test(text)), `Class A keyword: ${question}`);
    assert.ok(classB.some((pattern) => pattern.test(text)), `reaches the LLM fallback: ${question}`);
    assert.ok(matchRecordTool(question), `no record tool answers: ${question}`);
  }
});

test("every day-care starter is Class B and names a cohort filter", () => {
  const { classA, classB } = classifierScans();
  for (const question of COHORT_STARTERS) {
    const text = question.toLowerCase();
    assert.ok(!classA.some((pattern) => pattern.test(text)), `Class A keyword: ${question}`);
    assert.ok(classB.some((pattern) => pattern.test(text)), `reaches the LLM fallback: ${question}`);
    assert.notEqual(matchCohortIntent(question).kind, "unknown", question);
  }
});

test("the classifier patterns still refuse clinical judgment", () => {
  const { classA } = classifierScans();
  for (const question of ["should she proceed today?", "is it safe to give the dose?",
    "what is her prognosis?"]) assert.ok(classA.some((pattern) => pattern.test(question)), question);
});

test("coverage rows carry dates and packages, and a letter that disagrees is a conflict", () => {
  const auth = { auth_id: "PA-DC-04", payer_name: "PM-JAY", status: "approved",
    letter_status: "approved", requested_at: "2026-09-29T01:50:38", decided_at: "2026-10-01T01:50:38",
    expires_at: "2026-12-03T02:03:10" };
  const schemes = [{ schemeId: "PM-JAY", schemeName: "Pradhan Mantri Jan Arogya Yojana",
    status: "eligible", annualLimit: 500000, packages: ["PKG-ONCO-CHEMO-01"] }];
  const card = composeRecordAnswer(match("status of pre-authorisation"),
    { patient, coverage: { rows: [{ authorizations: [auth] }] }, schemes });
  const row = card.items.find((item) => item.id === "PA-DC-04");
  assert.match(row.value, /^Requested 29 Sep.*, decided 1 Oct/);
  assert.equal(row.state, "Approved");
  assert.match(card.items.at(-1).value, /^1 covered package: PKG-ONCO-CHEMO-01$/);
  assert.equal(card.items.at(-1).note, "Annual limit ₹5,00,000");
  const drift = composeRecordAnswer(match("status of pre-authorisation"), { patient,
    coverage: { rows: [{ authorizations: [{ ...auth, letter_status: "denied" }] }] }, schemes });
  const conflicted = drift.items.find((item) => item.id === "PA-DC-04");
  assert.equal(conflicted.state, "Conflict");
  assert.match(conflicted.note, /Letter says denied, table says approved/);
});
