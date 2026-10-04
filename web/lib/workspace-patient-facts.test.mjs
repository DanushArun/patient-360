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

test("timeline value state is derived from the value and never defaults to not_received (R3)", async () => {
  const { deriveValueState } = await import("./workspace-patient-facts.mjs");
  assert.equal(deriveValueState(undefined, -0.8, null), "present");
  assert.equal(deriveValueState(undefined, null, "IHC 2+"), "present");
  assert.equal(deriveValueState(undefined, null, null), "state_unavailable");
  assert.equal(deriveValueState(undefined, null, "   "), "state_unavailable");
  assert.equal(deriveValueState("pending", null, null), "pending");
  assert.equal(deriveValueState("not_received", null, null), "not_received");
  assert.equal(deriveValueState("bogus", 1, null), "present");
  assert.equal(factStateLabel(deriveValueState(undefined, null, null)), "State unavailable");
});

test("N4-04: a present event with a concept but no value never renders a bare Present", async () => {
  const { factStateDisplay } = await import("./workspace-patient-facts.mjs");
  assert.equal(factStateDisplay({ value_state: "present", value: null, value_text: null }),
    "Present · no value recorded");
  assert.equal(factStateDisplay({ value_state: "present", value: 0 }), "Present");
  assert.equal(factStateDisplay({ value_state: "present", value_text: "IHC 2+" }), "Present");
  assert.equal(factStateDisplay({ value_state: "pending" }), "Pending");
});
