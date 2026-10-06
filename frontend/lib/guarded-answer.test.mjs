import assert from 'node:assert/strict';
import test from 'node:test';
import * as boundary from './guarded-answer.mjs';
const { guardAnswer } = boundary;

const clock = '2026-10-04T15:00:00';
const candidate = { text: JSON.stringify({ claims: [{ text: 'candidate',
  claim_type: 'textual', evidence: [{ kind: 'structured', id: 'EV-1' }] }] }),
  thinking: 'private reasoning', tool_results: [{ result: { text: 'raw data' } }],
  gates: [{ reason: 'raw gate' }], suggested: ['untrusted suggestion'] };
const verified = { claims: [{ text: 'SQL recorded value', claim_type: 'textual',
  evidence: [{ kind: 'structured', id: 'EV-1', table: 'DT_HARMONIZED_EVENTS',
    event_time: clock, source_recorded_at: clock }] }],
  limitations: [], overall_status: 'supported', known_as_of: clock };

test('test_guard_when_validated_returns_only_canonical_claims', async () => {
  const result = await guardAnswer(candidate, async () => [{ RESULT: verified }], clock);
  assert.deepEqual(result, { text: 'SQL recorded value', thinking: '', tools: [],
    tool_results: [], gates: [], suggested: [], known_as_of: clock, error: null,
    artifact: { ...verified, classification: 'CLASS_B' } });
});

test('test_guard_when_validator_throws_never_returns_candidate', async () => {
  const result = await guardAnswer(candidate, async () => { throw new Error('SQL failed'); }, clock);
  assert.equal(JSON.stringify(result).includes('candidate'), false);
});

test('test_guard_when_unstructured_prose_is_returned_fails_closed', async () => {
  const result = await guardAnswer({ ...candidate, text: 'Unsafe prose' }, async () => [], clock);
  assert.equal(result.error, 'answer_validation_unavailable');
});

test('test_guard_when_sql_clock_differs_rejects_answer', async () => {
  const result = await guardAnswer(candidate,
    async () => [{ RESULT: { ...verified, known_as_of: '2026-10-05T00:00:00' } }], clock);
  assert.equal(result.error, 'answer_validation_unavailable');
});

test('test_guard_when_sql_rejects_claim_does_not_echo_rejected_text', async () => {
  const result = await guardAnswer(candidate, async () => [{ RESULT: { ...verified,
    claims: [], limitations: ['candidate raw text'], overall_status: 'partial' } }], clock);
  assert.equal(JSON.stringify(result).includes('candidate'), false);
});

test('test_guard_when_old_validator_returns_incomplete_evidence_rejects', async () => {
  const stale = { ...verified, claims: [{ ...verified.claims[0],
    evidence: [{ kind: 'structured', id: 'EV-1' }] }] };
  const result = await guardAnswer(candidate, async () => [{ RESULT: stale }], clock);
  assert.equal(result.error, 'answer_validation_unavailable');
});

test('test_guard_when_legacy_prose_cites_event_returns_sql_fact_only', async () => {
  let submitted;
  const result = await guardAnswer({ text: 'Treatment is safe [EVT-DC-04-PLT].' },
    async (_sql, binds) => { submitted = JSON.parse(binds[0]); return [{ RESULT: verified }]; },
    clock);
  assert.deepEqual({ text: result.text, submitted }, { text: 'SQL recorded value',
    submitted: [{ text: 'Recorded evidence', claim_type: 'textual',
      evidence: [{ kind: 'structured', id: 'EVT-DC-04-PLT' }] }] });
});

test('test_guard_when_json_has_unknown_properties_rejects_before_sql', async () => {
  const result = await guardAnswer({ text: JSON.stringify({ claims: [], patient_id: 'foreign' }) },
    async () => { throw new Error('must not call SQL'); }, clock);
  assert.equal(result.error, 'answer_validation_unavailable');
});

test('test_guard_when_malformed_json_contains_event_never_uses_fallback', async () => {
  const result = await guardAnswer({ text: '{"claims": EVT-DC-04-PLT' },
    async () => [{ RESULT: verified }], clock);
  assert.equal(result.error, 'answer_validation_unavailable');
});

test('test_gateway_when_canonical_artifact_returns_only_validated_fields', () => {
  assert.equal(typeof boundary.readGatewayAnswer, 'function');
  assert.equal(boundary.readGatewayAnswer({ ...verified, classification: 'CLASS_B' }).text,
    'SQL recorded value');
});

test('test_gateway_when_consent_withdrawn_propagates_access_error', () => {
  assert.equal(typeof boundary.readGatewayAnswer, 'function');
  assert.throws(() => boundary.readGatewayAnswer({ error: 'access_withdrawn',
    known_as_of: clock }), /access_withdrawn/);
});

test('test_gateway_when_raw_agent_payload_rejects_instead_of_displaying', () => {
  assert.equal(typeof boundary.readGatewayAnswer, 'function');
  assert.throws(() => boundary.readGatewayAnswer({ content: [{ type: 'text',
    text: 'Unsafe advice' }] }), /answer_contract_invalid/);
});

test('test_gateway_when_reference_quote_returns_frozen_contract_metadata', () => {
  const artifact = { classification: 'CLASS_B', known_as_of: clock,
    overall_status: 'partial', limitations: ['Reference is not a patient finding.'],
    claims: [{ text: 'Reference source passage: Exact quote', claim_type: 'textual',
      evidence: [{ kind: 'reference_clause', id: 'REF-CHUNK-1', doc_id: 'REF-DOC-1',
        page_index: 0, publisher: 'Government of Gujarat', document_title: 'Guidelines',
        version: '2013', jurisdiction: 'IN', effective_date: 'not_received' }] }] };
  assert.equal(boundary.readGatewayAnswer(artifact).text, artifact.claims[0].text);
});
