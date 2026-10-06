import assert from "node:assert/strict";
import test from "node:test";
import { documentLibraryRows, documentSourceHref, documentStateLabel }
  from "./workspace-documents.mjs";

test("document state labels preserve all seven governed states", () => {
  assert.deepEqual([
    "present", "explicitly_negative", "pending", "not_received",
    "conflicting", "unreadable", "superseded",
  ].map(documentStateLabel), [
    "Present", "Explicitly negative", "Pending", "Not received",
    "Conflicting", "Unreadable", "Superseded",
  ]);
});

test("document list uses returned metadata and does not invent verification or facility", () => {
  const [row] = documentLibraryRows([{
    doc_id: "DOC-SYNTHETIC-1", doc_type: "Lab report", version: 2,
    source_recorded_at: "2026-09-30T09:00:00", ingested_at: "2026-09-30T09:20:00",
  }], []);

  assert.deepEqual({
    title: row.title,
    state: row.state,
    verification: row.verification,
    sourceFacility: row.sourceFacility,
    documentId: row.document.doc_id,
  }, {
    title: "Lab report", state: "Received", verification: "Not returned",
    sourceFacility: "Not returned", documentId: "DOC-SYNTHETIC-1",
  });
});

test("document assertions keep query counts and observation time separate", () => {
  const [row] = documentLibraryRows([{
    doc_id: "DOC-SYNTHETIC-1", doc_type: "Lab report", source_facility: "City Labs",
    verified_assertions: 2, conflicting_assertions: 1, assertion_count: 4,
    verification_observed_at: "2026-10-01T09:43:00",
  }], []);

  assert.deepEqual({
    sourceFacility: row.sourceFacility,
    state: row.state,
    verification: row.verification,
    verificationObservedAt: row.verificationObservedAt,
  }, {
    sourceFacility: "City Labs", state: "Received",
    verification: "4 assertions · 2 verified · 1 conflicting",
    verificationObservedAt: "2026-10-01T09:43:00",
  });
});

test("expected final pathology uses the SQL missingness type without parsing prose", () => {
  const [row] = documentLibraryRows([], [{
    rule_id: "DOC-PATH-001", missingness_state: "not_received", title: "Final pathology",
    reason: "Final report not received",
  }]);

  assert.deepEqual({ title: row.title, state: row.state, ruleId: row.ruleId }, {
    title: "Final pathology", state: "Not received", ruleId: "DOC-PATH-001",
  });
});

test("expected pathology is not inferred from an unrelated rule or vague reason", () => {
  const rows = documentLibraryRows([], [
    { rule_id: "DOC-PATH-001", outcome: "not_evaluated", reason: "Evidence unavailable" },
    { rule_id: "DOC-HER2-001", outcome: "fail", reason: "no pathology reports on record" },
  ]);

  assert.equal(rows.length, 0);
});

test("source link preserves cutoff and returns to Documents", () => {
  assert.equal(documentSourceHref("PAT-DC-04", "DOC-1", "2026-10-01T09:42:00"),
    "/patient/PAT-DC-04/documents/DOC-1?page=0&known_as_of=2026-10-01T09%3A42%3A00"
      + "&return=documents");
});


test("test_expected_document_when_only_rule_prose_exists_does_not_invent_missingness", () => {
  assert.equal(documentLibraryRows([], [{ rule_id: "DOC-PATH-001",
    outcome: "not_evaluated", reason: "1 preliminary/pending report - awaiting final" }]).length, 0);
});
