import assert from "node:assert/strict";
import test from "node:test";
import { askLocalModel } from "./local-ai.mjs";

const timestamp = "2026-09-27T12:00:00";
const response = (content) => ({ choices: [{ message: { content: JSON.stringify(content) } }] });
const rows = (value) => [{ RESULT: value }];

test("dependent tools replan using returned readiness before requesting a task", async () => {
  const calls = [];
  let planningTurns = 0;
  const run = async (sql, binds) => {
    calls.push({ sql, binds });
    if (sql.includes("CLASSIFY_QUESTION")) return rows({ classification: "CLASS_B" });
    if (sql.includes("GET_READINESS")) return rows({ known_as_of: timestamp, gates: [{
      rule_id: "RULE-1", outcome: "not_evaluated", reason: "Report not received",
    }] });
    return rows({ task_id: "TASK-1", idempotent_replay: false });
  };
  const complete = async (messages, schema) => {
    if (!schema.properties.calls) return response({ claims: [] });
    planningTurns += 1;
    if (planningTurns === 1) return response({ focus: "all", continue: true,
      calls: [{ name: "GetReadiness", arguments: {} }],
    });
    assert.match(messages[1].content, /RULE-1/);
    return response({ focus: "all", continue: false, calls: [{
      name: "CreateReviewTask", arguments: { rule_id: "RULE-1", action: "request_document" },
    }] });
  };
  const turn = await askLocalModel("Request documents for missing checks", "PAT-1", run, complete);
  assert.equal(planningTurns, 2);
  assert.equal(calls.filter(({ sql }) => sql.includes("CREATE_REVIEW_TASK")).length, 1);
  assert.match(turn.text, /TASK-1/);
});

test("tool errors stop retrieval and never reach the answer model", async () => {
  let modelCalls = 0;
  const calls = [];
  const run = async (sql) => {
    calls.push(sql);
    return rows(sql.includes("CLASSIFY_QUESTION")
      ? { classification: "CLASS_B" } : { error: "access_withdrawn" });
  };
  const complete = async () => {
    modelCalls += 1;
    return response({ focus: "all", calls: [
      { name: "GetPatientFacts", arguments: { domain: "labs" } },
      { name: "GetTimeline", arguments: {} },
    ] });
  };
  const turn = await askLocalModel("List labs and timeline", "PAT-1", run, complete);
  assert.equal(turn.error, "access_withdrawn");
  assert.equal(modelCalls, 1);
  assert.equal(calls.length, 2);
});

test("the entire plan is checked before any task can be written", async () => {
  const calls = [];
  const run = async (sql) => {
    calls.push(sql);
    return rows(sql.includes("CLASSIFY_QUESTION") ? { classification: "CLASS_B" }
      : { gates: [{ rule_id: "RULE-1", outcome: "fail" }] });
  };
  const complete = async () => response({ focus: "all", calls: [
    { name: "CreateReviewTask", arguments: { rule_id: "RULE-1", action: "escalate" } },
    { name: "GetTimeline", arguments: { patientId: "PAT-OTHER" } },
  ] });
  const turn = await askLocalModel("Escalate missing evidence", "PAT-1", run, complete);
  assert.equal(turn.error, "local_model_tool_plan_invalid");
  assert.equal(calls.length, 1);
});

test("validated claims become typed artifacts with SQL timestamps", async () => {
  const claim = { text: "hemoglobin: 10", claim_type: "numeric", asserted_value: 10,
    evidence: [{ kind: "structured", id: "EVT-1", table: "DT_HARMONIZED_EVENTS",
      event_time: timestamp, source_recorded_at: timestamp,
    }],
  };
  let validated = false;
  const run = async (sql, binds) => {
    if (sql.includes("CLASSIFY_QUESTION")) return rows({ classification: "CLASS_B" });
    if (sql.includes("VALIDATE_ANSWER")) {
      validated = true;
      assert.deepEqual(JSON.parse(binds[0]), [claim]);
      return rows({ claims: [claim], limitations: [], known_as_of: timestamp });
    }
    return rows({ known_as_of: timestamp,
      facts: [{ event_id: "EVT-1", concept: "hemoglobin", value: 10,
        event_time: timestamp, source_recorded_at: timestamp,
      }],
    });
  };
  const complete = async (_messages, schema) => response(schema.properties.calls
    ? { focus: "all", calls: [{ name: "GetPatientFacts", arguments: { domain: "labs" } }] }
    : { claims: [claim] });
  const turn = await askLocalModel("List hemoglobin", "PAT-1", run, complete);
  assert.equal(validated, true);
  assert.deepEqual(turn.artifact.claims, [claim]);
  assert.equal(turn.known_as_of, timestamp);
  assert.match(turn.text, /EVT-1/);
});

test("validator failure strips model prose instead of passing by default", async () => {
  const run = async (sql) => {
    if (sql.includes("CLASSIFY_QUESTION")) return rows({ classification: "CLASS_B" });
    if (sql.includes("VALIDATE_ANSWER")) throw new Error("validator offline");
    return rows({ known_as_of: timestamp, facts: [{ event_id: "EVT-1", value: 10,
      event_time: timestamp, source_recorded_at: timestamp,
    }] });
  };
  const complete = async (_messages, schema) => response(schema.properties.calls
    ? { focus: "all", calls: [{ name: "GetPatientFacts", arguments: { domain: "labs" } }] }
    : { claims: [{ text: "Invented medical conclusion", claim_type: "textual",
      evidence: [{ kind: "structured", id: "EVT-1" }],
    }] });
  const turn = await askLocalModel("List labs", "PAT-1", run, complete);
  assert.doesNotMatch(turn.text, /Invented medical conclusion/);
  assert.equal(turn.artifact.overall_status, "partial");
  assert.ok(turn.artifact.limitations.includes("answer_validation_unavailable"));
});

test("all eight existing copilot tools remain reachable in local mode", async () => {
  const calls = [
    { name: "GetPatientFacts", arguments: { domain: "labs" } },
    { name: "GetReadiness", arguments: {} },
    { name: "GetTimeline", arguments: {} },
    { name: "GetChanges", arguments: { from_ts: timestamp } },
    { name: "SearchPatientDocuments", arguments: { query: "pathology" } },
    { name: "SearchReferenceDocuments", arguments: { query: "coverage" } },
    { name: "CohortQuery", arguments: { question: "count" } },
    { name: "CreateReviewTask", arguments: { rule_id: "RULE-1", action: "escalate" } },
  ];
  const run = async (sql) => rows(sql.includes("CLASSIFY_QUESTION")
    ? { classification: "CLASS_B" }
    : { known_as_of: timestamp, gates: [{ rule_id: "RULE-1", outcome: "fail" }] });
  const complete = async (_messages, schema) => response(schema.properties.calls
    ? { focus: "all", calls } : { claims: [] });
  const turn = await askLocalModel("Escalate and list record evidence", "PAT-1", run, complete);
  assert.deepEqual(turn.tools.map(({ name }) => name), calls.map(({ name }) => name));
});
