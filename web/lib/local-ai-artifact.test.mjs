import assert from "node:assert/strict";
import test from "node:test";
import { validateClaims } from "./local-ai-artifact.mjs";
import { executeTool, validateToolCall } from "./local-ai-tools.mjs";

const knownAsOf = "2026-09-27T12:00:00";
const context = { knownAsOf, results: [{ result: { facts: [{ event_id: "EVT-1", value: 10,
  event_time: knownAsOf, source_recorded_at: knownAsOf,
}] } }] };
const claim = { text: "Recorded fact: 10", claim_type: "numeric", asserted_value: 10,
  evidence: [{ kind: "structured", id: "EVT-1", table: "DT_HARMONIZED_EVENTS",
    event_time: knownAsOf, source_recorded_at: knownAsOf,
  }],
};

test("readiness tool cannot select an encounter", () => {
  assert.throws(
    () => validateToolCall("GetReadiness", { encounter_ref: "ENC-OTHER" }),
    { message: "invalid_tool_arguments" },
  );
});

test("fabricated citations are stripped before reaching SQL validation", async () => {
  let calls = 0;
  const run = async () => { calls += 1; return []; };
  const input = { claims: [{ ...claim, evidence: [{ kind: "structured", id: "INVENTED" }] }] };
  const result = await validateClaims(input, { ...context, run });
  assert.deepEqual(result.claims, []);
  assert.equal(calls, 0);
});

test("SQL-rejected claims remain limitations and never enter the artifact", async () => {
  const run = async () => [{ RESULT: {
    claims: [], limitations: ["check5_type_match: value mismatch"],
  } }];
  const result = await validateClaims({ claims: [claim] }, { ...context, run });
  assert.deepEqual(result, { claims: [], limitations: ["check5_type_match: value mismatch"] });
});

test("SQL JSON key order does not discard a valid claim", async () => {
  const reordered = { evidence: claim.evidence, asserted_value: 10,
    claim_type: "numeric", text: claim.text,
  };
  const run = async () => [{ RESULT: JSON.stringify({ claims: [reordered], limitations: [] }) }];
  const result = await validateClaims({ claims: [claim] }, { ...context, run });
  assert.deepEqual(result.claims, [reordered]);
});

test("model-written values and types are replaced by the actual SQL fact", async () => {
  let validatedClaim;
  const run = async (_sql, binds) => {
    validatedClaim = JSON.parse(binds[0])[0];
    return [{ RESULT: { claims: [validatedClaim], limitations: [] } }];
  };
  const result = await validateClaims({ claims: [{ text: "Value 99", claim_type: "numeric",
    evidence: claim.evidence,
  }] }, { ...context, run });
  assert.deepEqual(result.claims, [claim]);
  assert.deepEqual(validatedClaim, claim);
});

test("empty tool results produce an explicit error", async () => {
  const result = await executeTool("GetTimeline", {}, async () => [], "PAT-1");
  assert.equal(result.error, "malformed_tool_result");
});

test("tool evidence retains the actual Snowflake query identifier", async () => {
  const run = async () => Object.assign([{ RESULT: { timeline: [] } }], { query_id: "QUERY-1" });
  const result = await executeTool("GetTimeline", {}, run, "PAT-1");
  assert.equal(result.query_id, "QUERY-1");
});
