import assert from 'node:assert/strict';
import test from 'node:test';
import { withUiReadDeadline } from './ui-read-deadline.mjs';

test('test_ui_read_when_service_never_settles_returns_timeout', async () => {
  await assert.rejects(withUiReadDeadline(new Promise(() => {}), 5), /ui_read_timeout/);
});

test('test_ui_read_when_service_returns_preserves_its_result', async () => {
  assert.deepEqual(await withUiReadDeadline(Promise.resolve({ rows: ['source'] })),
    { rows: ['source'] });
});

test('test_ui_read_when_access_is_denied_preserves_original_failure', async () => {
  await assert.rejects(withUiReadDeadline(Promise.reject(new Error('no_patient_access'))),
    /no_patient_access/);
});
