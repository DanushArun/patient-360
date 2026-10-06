import assert from "node:assert/strict";
import test from "node:test";

import {
  coverageRequestKey,
  coverageResultForKey,
  coverageRowFromEnvelope,
  authorizationExcerptSpan,
  authorizationSourceHref,
} from "./workspace-authorization-read.mjs";

test("test_coverage_result_when_request_key_changes_hides_previous_patient_data", () => {
  const previous = { key: coverageRequestKey("PAT-1", "2026-10-01T09:42:00", 0),
    state: "ready", data: { authorizations: [{ auth_id: "AUTH-1" }] } };

  assert.deepEqual(coverageResultForKey(previous,
    coverageRequestKey("PAT-2", "2026-10-01T09:42:00", 0)),
  { key: coverageRequestKey("PAT-2", "2026-10-01T09:42:00", 0),
    state: "loading", data: null });
});

test("test_coverage_request_key_when_patient_cutoff_or_attempt_changes_is_distinct", () => {
  const base = coverageRequestKey("PAT-1", "2026-10-01T09:42:00", 0);

  assert.notEqual(coverageRequestKey("PAT-2", "2026-10-01T09:42:00", 0), base);
  assert.notEqual(coverageRequestKey("PAT-1", "2026-10-02T09:42:00", 0), base);
  assert.notEqual(coverageRequestKey("PAT-1", "2026-10-01T09:42:00", 1), base);
});

test("test_coverage_envelope_when_api_returns_rows_selects_only_first_row", () => {
  const row = { known_as_of: "2026-10-01T09:42:00", letters: [] };
  assert.equal(coverageRowFromEnvelope({ rows: [row, { known_as_of: "later" }] }), row);
  assert.equal(coverageRowFromEnvelope({ rows: [] }), null);
});

test("test_letter_source_when_exact_span_is_available_preserves_cutoff_and_return", () => {
  const href = authorizationSourceHref({ doc_id: "DOC-1", page_index: 0,
    char_start: 28, char_end: 39, source_link_status: "verified_assertion_exact_page_span" },
  "PAT-DC-04", "2026-10-01T09:42:00");

  assert.equal(href, "/patient/PAT-DC-04/documents/DOC-1?page=0&known_as_of="
    + "2026-10-01T09%3A42%3A00&return=coverage&start=28&end=39");
});

test("test_letter_source_when_exact_span_is_unverified_returns_no_link", () => {
  assert.equal(authorizationSourceHref({ doc_id: "DOC-1", page_index: 0,
    char_start: 28, char_end: 39 }, "PAT-DC-04", "2026-10-01T09:42:00"), null);
});

test("test_letter_source_when_verified_link_lacks_exact_coordinates_returns_no_link", () => {
  assert.equal(authorizationSourceHref({ doc_id: "DOC-1", page_index: 0,
    source_link_status: "verified_assertion_exact_page_span" }, "PAT-DC-04",
  "2026-10-01T09:42:00"), null);
});

test("test_letter_excerpt_when_verified_coordinates_fit_highlights_exact_returned_span", () => {
  const excerpt = `${"x".repeat(28)}30 Sep 2026 plus context`;
  const span = authorizationExcerptSpan({ verification_status: "verified",
    source_link_status: "verified_assertion_exact_page_span", char_start: 28,
    char_end: 39, excerpt_start: 0, excerpt });

  assert.equal(span.cited, "30 Sep 2026");
  assert.equal(span.before, "x".repeat(28));
});

test("test_letter_excerpt_when_span_is_unverified_is_not_highlighted", () => {
  assert.equal(authorizationExcerptSpan({ verification_status: "conflicting",
    source_link_status: "verified_assertion_exact_page_span", char_start: 28,
    char_end: 39, excerpt_start: 0, excerpt: `${"x".repeat(28)}30 Sep 2026` }), null);
});

test("test_letter_excerpt_when_window_starts_inside_page_uses_returned_offset", () => {
  const span = authorizationExcerptSpan({ verification_status: "verified",
    source_link_status: "verified_assertion_exact_page_span", char_start: 120,
    char_end: 131, excerpt_start: 30, excerpt: `${"x".repeat(90)}30 Sep 2026 trailing` });
  assert.equal(span?.cited, "30 Sep 2026");
});

test("test_letter_link_when_coordinate_is_null_refuses_exact_source", () => {
  assert.equal(authorizationSourceHref({ doc_id: "DOC-1", page_index: 0,
    char_start: null, char_end: 12, source_link_status: "verified_assertion_exact_page_span" },
  "PAT-DC-04", "2026-10-01T09:42:00"), null);
});


test('comparison source preserves its return destination', () => {
  const href = authorizationSourceHref({ doc_id: "DOC-1", page_index: 0,
    char_start: 2, char_end: 4, source_link_status: "verified_assertion_exact_page_span" },
  "PAT-1", "2026-09-23T14:14:48", "coverage-comparison");
  assert.equal(new URL(href, "http://localhost").searchParams.get("return"),
    "coverage-comparison");
});
