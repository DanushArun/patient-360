import assert from 'node:assert/strict';
import test from 'node:test';
import { documentRequest, readDocumentPage, documentReturn } from './document-source.mjs';

const cutoff = '2026-09-23T14:14:48';
const query = { page: '0', start: '6', end: '12', known_as_of: cutoff, return: 'ask' };
const row = { DOC_ID: 'DOC-1', PAGE_INDEX: 0, TEXT: 'First second third', VERSION: 2,
  SCOPE: 'patient', DOCUMENT_STATUS: 'duplicate', STATUS_OBSERVED_AT: cutoff,
  INGESTED_AT: '2026-09-22T00:00:00' };

test('test_request_when_citation_has_cutoff_keeps_procedure_bound', () => {
  assert.equal(documentRequest('DOC-1', query).argument, `DOC-1|${cutoff}`);
});

test('test_source_when_exact_span_valid_highlights_only_that_span', () => {
  assert.deepEqual(readDocumentPage([row], documentRequest('DOC-1', query)).highlight,
    { before: 'First ', cited: 'second', after: ' third' });
});

test('test_source_when_span_absent_does_not_claim_exact_highlight', () => {
  assert.equal(readDocumentPage([row], documentRequest('DOC-1', { page: '0' })).highlight, null);
});

test('test_source_when_requested_page_absent_rejects', () => {
  assert.throws(() => readDocumentPage([row], documentRequest('DOC-1', { page: '1' })),
    /source_unavailable/);
});

test('test_source_when_doc_identity_differs_rejects', () => {
  assert.throws(() => readDocumentPage([{ ...row, DOC_ID: 'DOC-2' }],
    documentRequest('DOC-1', query)), /source_invalid/);
});

for (const patch of [{ page: '-1' }, { start: '6', end: '200' },
  { known_as_of: '2026-02-30T14:14:48' }, { known_as_of: 'tomorrow' }]) {
  test(`test_source_when_query_invalid_${JSON.stringify(patch)}_rejects`, () => {
    assert.throws(() => readDocumentPage([row],
      documentRequest('DOC-1', { ...query, ...patch })), /source_invalid/);
  });
}

test('test_return_when_ask_selected_restores_section_hash', () => {
  assert.equal(documentReturn('PAT-1', 'ask'), '/patient/PAT-1#ask-record');
});

test('test_return_when_arbitrary_url_supplied_uses_patient_record', () => {
  assert.equal(documentReturn('PAT-1', 'https://example.com'), '/patient/PAT-1');
});

test('test_return_when_facts_selected_restores_origin_section', () => {
  assert.equal(documentReturn('PAT-1', 'facts'), '/patient/PAT-1#facts');
});


test('source return restores authorization comparison context', () => {
  assert.equal(documentReturn('PAT-1', 'coverage-comparison'),
    '/patient/PAT-1#coverage-comparison');
});
