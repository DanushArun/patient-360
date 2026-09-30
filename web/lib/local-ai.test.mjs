import assert from "node:assert/strict";
import test from "node:test";

import { askLocalModel } from "./local-ai.mjs";

function rows(value) {
  return [{ RESULT: value }];
}

test("clinical questions are refused and redirected to record-state questions", async () => {
  let modelCalls = 0;
  const run = async () => rows({ classification: "CLASS_A", method: "keyword" });
  const complete = async () => {
    modelCalls += 1;
    return { choices: [{ message: { content: "unsafe answer" } }] };
  };

  const turn = await askLocalModel("What is wrong with this patient?", "PAT-1", run, complete);

  assert.match(turn.text, /treating practitioner's judgment/i);
  assert.match(turn.text, /documented findings, missing records, or conflicting sources/i);
  assert.equal(modelCalls, 0);
  assert.equal(turn.error, null);
});

test("Class B questions use only patient-bound Snowflake tools", async () => {
  const calls = [];
  const claim = { text: "hemoglobin: 10", claim_type: "numeric", asserted_value: 10,
    evidence: [{ kind: "structured", id: "EVT-1", table: "DT_HARMONIZED_EVENTS",
      event_time: "2026-09-27T09:00:00", source_recorded_at: "2026-09-27T09:00:00",
    }],
  };
  const run = async (sql, binds = []) => {
    calls.push({ sql, binds });
    if (sql.includes("CLASSIFY_QUESTION")) {
      return rows({ classification: "CLASS_B", method: "structure" });
    }
    if (sql.includes("VALIDATE_ANSWER")) return rows({ claims: [claim], limitations: [] });
    return rows({ known_as_of: "2026-09-27T12:00:00",
      facts: [{ event_id: "EVT-1", concept: "hemoglobin", value: 10,
        event_time: "2026-09-27T09:00:00", source_recorded_at: "2026-09-27T09:00:00",
      }],
    });
  };
  let modelCalls = 0;
  const complete = async (_messages, schema) => {
    modelCalls += 1;
    if (schema?.properties?.calls) {
      assert.ok(!_messages[0].content.includes("patient_id"));
      return {
        choices: [{ message: { content: JSON.stringify({
          calls: [{ name: "GetPatientFacts", arguments: { domain: "labs" } }],
          focus: "all",
        }) } }],
      };
    }
    return { choices: [{ message: { content: JSON.stringify({
      claims: [claim],
    }) } }] };
  };

  const turn = await askLocalModel("What is on file?", "PAT-1", run, complete);

  assert.equal(turn.text, "hemoglobin: 10 (EVT-1)");
  assert.ok(calls.some(({ sql }) => sql.includes("GET_PATIENT_FACTS")));
  assert.equal(modelCalls, 2);
  assert.ok(turn.tools.every((tool) => !tool.took_patient_id));
});

test("the model plans a Snowflake call before phrasing readiness facts", async () => {
  const calls = [];
  const run = async (sql, binds = []) => {
    calls.push({ sql, binds });
    return rows(sql.includes("CLASSIFY_QUESTION")
      ? { classification: "CLASS_B" }
      : { gates: [
        { rule_id: "CLIN-ANC-001", outcome: "fail", reason: "ANC missing" },
        { rule_id: "ENDO-DEXA-001", outcome: "not_evaluated", reason: "no T_SCORE evidence" },
      ] });
  };
  let modelCalls = 0;
  const complete = async (_messages, schema) => {
    modelCalls += 1;
    if (schema?.properties?.calls) return { choices: [{ message: { content: JSON.stringify({
      calls: [{ name: "GetReadiness", arguments: {} }],
      focus: "all",
    }) } }] };
    assert.match(_messages[1].content, /CLIN-ANC-001/);
    assert.doesNotMatch(_messages[1].content, /ENDO-DEXA-001/);
    return { choices: [{ message: { content: JSON.stringify({
      answer: "CLIN-ANC-001 failed because ANC is missing.",
    }) } }] };
  };

  const turn = await askLocalModel("List failed readiness checks", "PAT-1", run, complete);

  assert.match(turn.text, /CLIN-ANC-001/);
  assert.equal(modelCalls, 2);
  assert.ok(calls.some(({ sql }) => sql.includes("GET_READINESS")));
});

test("final model prompt excludes reasoning and raw tool output", async () => {
  const run = async (sql) => rows(sql.includes("CLASSIFY_QUESTION")
    ? { classification: "CLASS_B" }
    : { facts: [{ event_id: "EVT-1", domain: "labs" }] });
  let finalPrompt = "";
  const complete = async (messages, schema) => {
    if (schema?.properties?.calls) return { choices: [{ message: { content: JSON.stringify({
      calls: [{ name: "GetPatientFacts", arguments: { domain: "labs" } }],
      focus: "all",
    }) } }] };
    finalPrompt = messages[0].content;
    return { choices: [{ message: { content: JSON.stringify({
      answer: "Lab result recorded (EVT-1).",
    }) } }] };
  };

  await askLocalModel("List lab results", "PAT-1", run, complete);

  assert.match(finalPrompt, /do not reveal.*reasoning/i);
  assert.match(finalPrompt, /never write raw tool JSON/i);
});

test("a local tool call cannot select a patient", async () => {
  const calls = [];
  const run = async (sql) => {
    calls.push(sql);
    return rows({ classification: "CLASS_B" });
  };
  const complete = async (_messages, schema) => schema?.properties?.calls
    ? { choices: [{ message: { content: JSON.stringify({ focus: "all", calls: [{
      name: "GetPatientFacts",
      arguments: { domain: "labs", patient_id: "PAT-OTHER" },
    }] }) } }] }
    : { choices: [{ message: { content: JSON.stringify({ answer: "Must not phrase this." }) } }] };

  const turn = await askLocalModel("List lab results", "PAT-1", run, complete);

  assert.equal(turn.error, "local_model_tool_plan_invalid");
  assert.equal(calls.length, 1);
});

test("classification failures show a routing error without calling the model", async () => {
  let modelCalls = 0;
  const run = async () => { throw new Error("Snowflake classifier unavailable"); };
  const complete = async () => {
    modelCalls += 1;
    return { choices: [{ message: { content: "answer" } }] };
  };

  const turn = await askLocalModel("What is missing?", "PAT-1", run, complete);

  assert.equal(turn.error, "classification_unavailable");
  assert.equal(modelCalls, 0);
});

test("the local model can route document searches through Snowflake", async () => {
  const calls = [];
  const run = async (sql, binds = []) => {
    calls.push({ sql, binds });
    return rows(sql.includes("CLASSIFY_QUESTION")
      ? { classification: "CLASS_B" }
      : { results: [{ kind: "document_span", doc_id: "DOC-1", page_index: 1 }] });
  };
  let turnCount = 0;
  const complete = async (messages, schema) => {
    turnCount += 1;
    if (schema?.properties?.calls) {
      assert.ok(messages[0].content.includes("SearchPatientDocuments"));
      assert.ok(messages[0].content.includes("CreateReviewTask"));
      assert.ok(!messages[0].content.includes("patient_id"));
      return { choices: [{ message: { content: JSON.stringify({ calls: [{
        name: "SearchPatientDocuments", arguments: { query: "pathology" },
      }], focus: "all" }) } }] };
    }
    assert.ok(messages[1].content.includes('"doc_id":"DOC-1"'));
    return { choices: [{ message: { content: JSON.stringify({
      answer: "One document matched (DOC-1).",
    }) } }] };
  };

  const turn = await askLocalModel("Is the pathology report on file?", "PAT-1", run, complete);

  assert.ok(turn.artifact.limitations.includes("unstructured_answer_stripped"));
  assert.equal(turn.tool_results[0].result.results[0].doc_id, "DOC-1");
  assert.ok(calls.some(({ sql }) => sql.includes("SEARCH_PATIENT_DOCUMENTS")));
});

test("task writes use a SQL-returned actionable rule and derive bound scope", async () => {
  const calls = [];
  const run = async (sql, binds = []) => {
    calls.push({ sql, binds });
    if (sql.includes("CLASSIFY_QUESTION")) return rows({ classification: "CLASS_B" });
    if (sql.includes("GET_READINESS")) {
      return rows({ gates: [{
        rule_id: "CLIN-ANC-001",
        outcome: "fail",
        reason: "ANC assessment missing",
      }] });
    }
    return rows({ task_id: "TASK-1", idempotent_replay: false });
  };
  let turnCount = 0;
  const complete = async (_messages, schema) => {
    turnCount += 1;
    if (schema?.properties?.calls) return { choices: [{ message: { content: JSON.stringify({
      calls: [{
      name: "CreateReviewTask",
      arguments: { rule_id: "CLIN-ANC-001", action: "request_document" },
    }], focus: "all" }) } }] };
    return responseForAnswer("Review task created.");
  };

  await askLocalModel("Request the missing ANC document", "PAT-1", run, complete);

  const write = calls.find(({ sql }) => sql.includes("CREATE_REVIEW_TASK"));
  assert.deepEqual(write.binds, [
    "PAT-1:CLIN-ANC-001",
    "request_document",
    "Request document: CLIN-ANC-001: ANC assessment missing",
    "PAT-1:CLIN-ANC-001:request_document",
  ]);
});

test("a model cannot create a review task without an explicit user request", async () => {
  const calls = [];
  const run = async (sql) => {
    calls.push(sql);
    return rows({ classification: "CLASS_B" });
  };
  const complete = async () => ({ choices: [{ message: { content: JSON.stringify({
    focus: "all",
    calls: [{ name: "CreateReviewTask", arguments: {
      rule_id: "CLIN-ANC-001", action: "request_document",
    } }],
  }) } }] });

  const turn = await askLocalModel("List failed readiness checks", "PAT-1", run, complete);

  assert.equal(turn.error, "local_model_tool_plan_invalid");
  assert.equal(calls.length, 1);
});

test("missing-data answers exclude a present value that fails a threshold", async () => {
  const run = async (sql) => rows(sql.includes("CLASSIFY_QUESTION")
    ? { classification: "CLASS_B" }
    : { gates: [
      { rule_id: "CLIN-ANC-001", outcome: "fail", reason: "ANC is 1160, below threshold 1500" },
      { rule_id: "ENDO-DEXA-001", outcome: "not_evaluated", reason: "no T_SCORE evidence found" },
    ] });
  let answerInput = "";
  const complete = async (messages, schema) => {
    if (schema.properties.calls) return { choices: [{ message: { content: JSON.stringify({
      focus: "all", calls: [{ name: "GetReadiness", arguments: {} }],
    }) } }] };
    answerInput = messages[1].content;
    return responseForAnswer("T_SCORE not received.");
  };

  await askLocalModel("What is missing?", "PAT-1", run, complete);

  assert.doesNotMatch(answerInput, /CLIN-ANC-001/);
  assert.match(answerInput, /ENDO-DEXA-001/);
});

function responseForAnswer(answer) {
  return { choices: [{ message: { content: JSON.stringify({ answer }) } }] };
}
