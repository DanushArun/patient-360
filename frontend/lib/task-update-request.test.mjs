import assert from 'node:assert/strict';
import test from 'node:test';
import { readTaskUpdate, storeTaskUpdate, taskUpdateKey } from './task-update-request.mjs';

const attempt = { id: 'd8cc0117-bc55-4e66-8a77-6437e4d116bd', payload: JSON.stringify({
  taskId: 'TASK-1', action: 'acknowledge', ownerId: null, reason: 'Reviewed sources.', version: 1,
}) };
const key = taskUpdateKey('PAT-1', 'TASK-1');

function memory() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}

test('test_uncertain_update_when_reloaded_restores_identical_payload_and_key', () => {
  const storage = memory();
  storeTaskUpdate(storage, key, attempt);
  assert.deepEqual(readTaskUpdate(storage, key, 'TASK-1').attempt, attempt);
});

test('test_update_when_other_task_attempt_is_stored_rejects_it', () => {
  const storage = memory();
  storeTaskUpdate(storage, key, attempt);
  assert.equal(readTaskUpdate(storage, key, 'TASK-2').error, true);
});

test('test_confirmed_update_when_cleared_does_not_restore', () => {
  const storage = memory();
  storeTaskUpdate(storage, key, attempt);
  storeTaskUpdate(storage, key, null);
  assert.equal(readTaskUpdate(storage, key, 'TASK-1').attempt, null);
});

test('test_storage_when_denied_reports_failure', () => {
  assert.equal(storeTaskUpdate({ setItem() { throw new Error('denied'); } }, key, attempt), false);
});
