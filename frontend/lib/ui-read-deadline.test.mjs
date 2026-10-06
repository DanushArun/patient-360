import assert from 'node:assert/strict';
import test from 'node:test';
import { withUiReadDeadline } from './ui-read-deadline.mjs';

test('live Snowflake read may take thirteen seconds without being reported unavailable', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const read = new Promise(resolve => setTimeout(() => resolve({ patientId: 'PAT-DC-04' }), 13000));
  const result = withUiReadDeadline(read);
  t.mock.timers.tick(13000);
  assert.deepEqual(await result, { patientId: 'PAT-DC-04' });
});

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
