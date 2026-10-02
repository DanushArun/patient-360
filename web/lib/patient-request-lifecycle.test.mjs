import test from 'node:test';
import assert from 'node:assert/strict';
import { isCurrentPatientRequest } from './patient-request-lifecycle.mjs';

test('test_patient_request_when_patient_changes_rejects_old_response', () => {
  const controller = new AbortController();
  assert.equal(isCurrentPatientRequest('PAT-1', 'PAT-2', controller.signal), false);
});

test('test_patient_request_when_component_unmounts_rejects_aborted_response', () => {
  const controller = new AbortController();
  controller.abort();
  assert.equal(isCurrentPatientRequest('PAT-1', 'PAT-1', controller.signal), false);
});

test('test_patient_request_when_patient_and_signal_are_current_accepts_response', () => {
  const controller = new AbortController();
  assert.equal(isCurrentPatientRequest('PAT-1', 'PAT-1', controller.signal), true);
});
