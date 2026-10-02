import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearPatientTurns,
  invalidateChatRequest,
  updateChatContext,
} from './chat-lifecycle.mjs';
import { isLatestPatientResponse } from './workspace-state.mjs';

test('test_chat_request_when_unmounted_is_aborted_and_stale', () => {
  const activeRequest = { current: new AbortController() };
  const sequence = { current: 4 };
  invalidateChatRequest({ activeRequest, sequence });

  assert.equal(activeRequest.current, null);
  assert.equal(sequence.current, 5);
  assert.equal(isLatestPatientResponse('PAT-1', 'PAT-1', 4, sequence.current), false);
});

test('test_chat_request_when_scope_changes_old_request_is_aborted', () => {
  const context = {
    patientId: 'PAT-1', storageKey: 'saarthi-turns:PAT-1:reference',
    activePatient: { current: 'PAT-1' },
    activeStorageKey: { current: 'saarthi-turns:PAT-1:patient' },
    activeRequest: { current: new AbortController() },
    sequence: { current: 7 },
    lastQuestions: { current: { patient: 'CBC', reference: '' } },
  };
  const request = context.activeRequest.current;

  assert.equal(updateChatContext(context), true);

  assert.equal(request.signal.aborted, true);
  assert.equal(context.activeStorageKey.current, context.storageKey);
  assert.equal(context.sequence.current, 8);
});

test('test_patient_turns_when_access_is_purged_all_scopes_are_removed', () => {
  const values = new Map([
    ['saarthi-turns:PAT-1:patient', '[1]'],
    ['saarthi-turns:PAT-1:reference', '[2]'],
    ['saarthi-turns:PAT-2:patient', '[3]'],
  ]);
  const storage = { removeItem: (key) => values.delete(key) };

  clearPatientTurns(storage, 'PAT-1');

  assert.deepEqual([...values], [['saarthi-turns:PAT-2:patient', '[3]']]);
});
