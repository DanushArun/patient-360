import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertAnswerContract } from "./answer-contract.mjs";

function answer() {
  return {
    classification: "CLASS_B", claims: [], limitations: ["No eligible sources"],
    overall_status: "partial", known_as_of: "2026-10-02T09:00:00",
    binding_id: "binding-1", rule_versions: {},
  };
}

test("test_answer_when_frozen_contract_valid_is_accepted", () => {
  assert.doesNotThrow(() => assertAnswerContract(answer()));
});

test("test_answer_when_cutoff_missing_is_rejected", () => {
  assert.throws(() => assertAnswerContract({ ...answer(), known_as_of: null }),
    { message: "answer_contract_invalid" });
});

test("test_answer_when_confidence_added_is_rejected", () => {
  assert.throws(() => assertAnswerContract({ ...answer(), confidence: 99 }),
    { message: "answer_contract_invalid" });
});

test("test_answer_when_class_a_has_no_practitioner_is_rejected", () => {
  assert.throws(() => assertAnswerContract({
    ...answer(), classification: "CLASS_A", overall_status: "refused",
  }), { message: "answer_contract_invalid" });
});

test("test_answer_when_document_citation_has_no_exact_span_is_rejected", () => {
  assert.throws(() => assertAnswerContract({ ...answer(), claims: [{
    text: "Recorded result", claim_type: "textual",
    evidence: [{ kind: "document_span", id: "assertion-1", doc_id: "doc-1" }],
  }] }), { message: "answer_contract_invalid" });
});

test("test_answer_when_numeric_type_is_string_is_not_coerced", () => {
  assert.throws(() => assertAnswerContract({ ...answer(), rule_versions: { rule: "1" } }),
    { message: "answer_contract_invalid" });
});

for (const fixture of ["answer_class_a", "answer_conflicting", "answer_supported"]) {
  test(`test_${fixture}_when_existing_frozen_fixture_is_accepted`, () => {
    const path = new URL(`../../frontend/fixtures/${fixture}.json`, import.meta.url);
    assert.doesNotThrow(() => assertAnswerContract(JSON.parse(readFileSync(path, "utf8"))));
  });
}
