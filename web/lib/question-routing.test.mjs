import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { routeQuestion } from "./question-routing.mjs";

function rows(value) {
  return [{ RESULT: value }];
}

test("record conflict questions reach the record agent", async () => {
  let agentCalls = 0;
  const run = async () => rows({ classification: "CLASS_B", method: "structure" });

  const turn = await routeQuestion("What are the conflicts?", run, async () => {
    agentCalls += 1;
    return { text: "record answer", error: null };
  });

  assert.equal(turn.text, "record answer");
  assert.equal(agentCalls, 1);
});

test("clinical assessment questions stop before the record agent", async () => {
  let agentCalls = 0;
  const run = async () => rows({ classification: "CLASS_A", method: "keyword" });

  const turn = await routeQuestion("What is wrong with this patient?", run, async () => {
    agentCalls += 1;
    return { text: "must not run" };
  });

  assert.match(turn.text, /treating practitioner's judgment/i);
  assert.equal(agentCalls, 0);
});

test("classifier failures show a routing error instead of a clinical refusal", async () => {
  let agentCalls = 0;

  const turn = await routeQuestion("What are the conflicts?", async () => {
    throw new Error("classifier unavailable");
  }, async () => {
    agentCalls += 1;
    return { text: "must not run" };
  });

  assert.equal(turn.error, "classification_unavailable");
  assert.equal(agentCalls, 0);
});

test("agent readiness schema cannot invent an encounter identifier", async () => {
  const spec = await readFile(new URL("../../backend/sql/agent/saarthi_agent.sql", import.meta.url), "utf8");
  const readinessTool = spec.split('name: "GetReadiness"')[1].split("    - tool_spec:")[0];

  assert.doesNotMatch(readinessTool, /encounter_ref/);
});
