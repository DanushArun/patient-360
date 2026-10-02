import test from 'node:test';
import assert from 'node:assert/strict';
import { filterAuthorizedPatients } from './authorized-patient-search.mjs';

const patients = [
  { id: 'PAT-DC-04', name: 'Fatima Begum' },
  { id: 'PAT-DC-02', name: 'Gopal Das' },
];

test('test_filter_authorized_patients_when_name_query_matches_ignoring_case', () => {
  assert.deepEqual(filterAuthorizedPatients(patients, 'fatima'), [patients[0]]);
});

test('test_filter_authorized_patients_when_id_query_matches', () => {
  assert.deepEqual(filterAuthorizedPatients(patients, 'pat-dc-02'), [patients[1]]);
});

test('test_filter_authorized_patients_when_unavailable_returns_no_patients', () => {
  assert.deepEqual(filterAuthorizedPatients(patients, '', false), []);
});
