import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildReviewQueuePreview } from './review-queue-preview.mjs';

const recorded = JSON.parse(readFileSync(new URL('../../frontend/fixtures/daycare_census_recorded.json', import.meta.url), 'utf8'));

test('queue names, identifiers and clinical results come from the same recorded row', () => {
  const preview = buildReviewQueuePreview(recorded);
  assert.equal(preview.recordedAt, recorded.recorded_at);
  assert.equal(preview.issues.length, 17);
  assert.equal(preview.patients.length, 11);
  for (const issue of preview.issues) {
    const source = recorded.rows.find(row => row.patient_id === issue.patient_id
      && row.encounter_id === issue.issue_id.split(':')[0] && row.rule_id === issue.rule_id);
    assert.ok(source);
    assert.equal(issue.patient_name, source.name);
    for (const field of ['outcome', 'severity', 'reason', 'rule_version', 'scheduled']) {
      assert.equal(issue[field], source[field]);
    }
    assert.equal(preview.patients.find(p => p.id === issue.patient_id)?.name, issue.patient_name);
  }
  assert.ok(!preview.patients.some(p => ['PAT-0055', 'PAT-0061', 'PAT-0070', 'PAT-0082'].includes(p.id)));
  assert.ok(preview.issues.some(i => i.patient_name === 'Gopal Das' && i.patient_id === 'PAT-DC-07'
    && i.rule_id === 'COV-AUTH-001' && i.outcome === 'conflicting'));
});

test('missing workflow details remain unknown rather than invented assignments or states', () => {
  for (const issue of buildReviewQueuePreview(recorded).issues) {
    assert.equal(issue.state, null);
    assert.equal(issue.owner_practitioner_name, null);
    assert.notEqual(issue.outcome, 'pass');
  }
});

test('visit urgency uses the snapshot date, not the computer clock', () => {
  assert.ok(buildReviewQueuePreview(recorded).issues.every(i => i.days_to_visit === 1));
  const shifted = { ...recorded, recorded_at: '2026-09-22T23:59:59' };
  assert.ok(buildReviewQueuePreview(shifted).issues.every(i => i.days_to_visit === 2));
});

test('identity mismatches fail closed and duplicate results do not duplicate the queue', () => {
  const source = recorded.rows.find(r => r.outcome !== 'pass');
  const one = { ...recorded, rows: [source] };
  assert.equal(buildReviewQueuePreview({ ...one, rows: [source, { ...source }] }).issues.length, 1);
  const anotherExistingName = recorded.rows.find(r => r.patient_id !== source.patient_id).name;
  assert.throws(() => buildReviewQueuePreview({ ...one, rows: [source, { ...source, name: anotherExistingName }] }),
    /identity_conflict/);
  assert.throws(() => buildReviewQueuePreview({ ...one, rows: [{ ...source, name: '' }] }), /missing_identity/);
  assert.throws(() => buildReviewQueuePreview({ ...one, rows: [source, { ...source, outcome: 'conflicting' }] }),
    /result_conflict/);
});

test('queue projection never mutates the project fixture', () => {
  const before = JSON.stringify(recorded);
  buildReviewQueuePreview(recorded);
  assert.equal(JSON.stringify(recorded), before);
});
