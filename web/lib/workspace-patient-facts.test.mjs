import assert from "node:assert/strict";
import test from "node:test";
import {
  factStateLabel,
  factValueLabel,
  factsTemporalDescription,
  sourceDocumentHref,
} from "./workspace-patient-facts.mjs";

test("lab value label preserves returned text and hides values for non-present states", () => {
  assert.equal(factValueLabel({ value_state: "present", value_text: "IHC 2+", value: 2 }),
    "IHC 2+");
  assert.equal(factValueLabel({ value_state: "present", value: 0 }), "0");
  assert.equal(factValueLabel({ value_state: "not_received", value: 17 }), "—");
});

test("missingness labels preserve all governed states", () => {
  assert.deepEqual([
    "present", "explicitly_negative", "pending", "not_received", "conflicting",
    "unreadable", "superseded",
  ].map(factStateLabel), [
    "Present", "Explicitly negative", "Pending", "Not received", "Conflicting",
    "Unreadable", "Superseded",
  ]);
});

test("fact links return to Facts at the exact ingested cutoff", () => {
  assert.equal(sourceDocumentHref("PAT-DC-04", "DOC-CBC-1", "2026-09-23T14:14:48"),
    "/patient/PAT-DC-04/documents/DOC-CBC-1?page=0&known_as_of="
      + "2026-09-23T14%3A14%3A48&return=facts");
  assert.equal(sourceDocumentHref("PAT-DC-04", "DOC-CBC-1", null), null);
});

test("mutable facts explain current-at-query semantics without claiming history", () => {
  assert.equal(factsTemporalDescription({ as_of_semantics: "current_at_query",
    known_as_of: "2026-10-02T09:00:00", requested_known_as_of: "2026-09-23T14:14:48" }),
  "Current facts read at 2026-10-02T09:00:00; the requested historical cutoff does not apply.");
});
