import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bestQuote, composeReferenceAnswer, questionTerms } from "./reference-answer.mjs";
import { assertAnswerContract } from "./answer-contract.mjs";

const catalog = JSON.parse(readFileSync(new URL("../../data/reference/catalog.json", import.meta.url), "utf8"));
const herceptin = catalog.entries.find((entry) => entry.filename.startsWith("fda_herceptin"));
const docId = `REF-${herceptin.sha256.slice(0, 24)}`;
const page = " \n \nWithhold Herceptin for ≥ 16% absolute decrease in LVEF from pre-treatment values or an LVEF \n"
  + "value below institutional limits of normal. Assess LVEF prior to initiation. Store vials at 2-8 C.";

test("test_reference_answer_quotes_the_matching_sentences_verbatim_with_their_source", () => {
  const artifact = composeReferenceAnswer({ question: "When is trastuzumab withheld for LVEF?",
    hits: [{ id: "CHUNK-1", doc_id: docId, page_index: 5, jurisdiction: "US", text: page }],
    catalog, knownAsOf: "2026-10-06T08:21:00" });
  assertAnswerContract(artifact);
  assert.equal(artifact.classification, "CLASS_B");
  assert.equal(artifact.claims.length, 1);
  const [claim] = artifact.claims;
  assert.match(claim.text, /^“Withhold Herceptin for ≥ 16% absolute decrease in LVEF/);
  assert.doesNotMatch(claim.text, /Store vials/, "unrelated sentences are not quoted");
  assert.equal(claim.evidence[0].kind, "reference_clause");
  assert.equal(claim.evidence[0].page_index, 5);
  assert.equal(claim.evidence[0].publisher, "U.S. Food and Drug Administration");
  assert.equal(claim.evidence[0].effective_date, "Not stated in the document");
  assert.match(claim.provenance_note, /page 6$/);
});

test("test_reference_answer_drops_unattributed_or_unmatched_pages_and_says_so", () => {
  const artifact = composeReferenceAnswer({ question: "LVEF withholding",
    hits: [{ id: "X", doc_id: "REF-unknown", page_index: 1, text: page },
      { id: "Y", doc_id: docId, page_index: 2, text: "Nothing relevant here at all." }],
    catalog, knownAsOf: "2026-10-06T08:21:00" });
  assertAnswerContract(artifact);
  assert.equal(artifact.claims.length, 0);
  assert.equal(artifact.overall_status, "partial");
  assert.match(artifact.limitations[0], /No passage in the reference documents/);
});

test("test_reference_answer_never_quotes_the_same_page_twice_and_caps_length", () => {
  const long = Array.from({ length: 40 }, () => "LVEF monitoring is required every three months.").join(" ");
  const artifact = composeReferenceAnswer({ question: "LVEF monitoring",
    hits: [{ id: "A", doc_id: docId, page_index: 3, text: long },
      { id: "B", doc_id: docId, page_index: 3, text: long }],
    catalog, knownAsOf: "2026-10-06T08:21:00" });
  assert.equal(artifact.claims.length, 1);
  assert.ok(artifact.claims[0].evidence[0].clause.length <= 420);
});

test("test_question_terms_ignore_filler_and_patient_words", () => {
  assert.deepEqual(questionTerms("What does the guideline say about her HbA1c target?"),
    ["hba1c", "target"]);
  assert.equal(bestQuote("Nothing matches.", ["lvef"]), null);
});

test("test_reference_quote_keeps_abbreviations_and_ignores_the_documents_own_name", () => {
  const text = "HERCEPTIN (trastuzumab) for injection, for intravenous use Initial U.S. Approval: 1998. "
    + "WARNINGS AND PRECAUTIONS: Cardiomyopathy can occur. Evaluate cardiac function before therapy.";
  const artifact = composeReferenceAnswer({ question: "What does the trastuzumab label list under warnings?",
    hits: [{ id: "W", doc_id: docId, page_index: 0, text }], catalog, knownAsOf: "2026-10-06T08:21:00" });
  assert.match(artifact.claims[0].text, /^“WARNINGS AND PRECAUTIONS/);
  assert.match(bestQuote("Initial U.S. Approval: 1998. Other text.", ["approv"]).quote,
    /^Initial U\.S\. Approval: 1998\./);
});
