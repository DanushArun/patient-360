import test from 'node:test';
import assert from 'node:assert/strict';
import { backendHealth } from './backend-health.mjs';

const revision = 'a'.repeat(40);
const queryId = '01c78441-0004-0e08-0001-fe5a00170f02';
function successfulRows() {
  const rows = [{ RESULT: { rows: [{ NAME: 'Private fixture name' }] } }];
  Object.defineProperty(rows, 'query_id', { value: queryId });
  return rows;
}

test('backend health requires an explicit release revision before connecting', async () => {
  const result = await backendHealth(() => { throw new Error('must not connect'); }, '');
  assert.equal(result.statusCode, 503);
});

test('backend health returns actual query ID without patient content', async () => {
  const result = await backendHealth(async () => successfulRows(), revision);
  assert.deepEqual(result, { statusCode: 200, body: {
    status: 'ready', service: 'saarthi-web-backend', release_revision: revision,
    database: { status: 'ready', query_id: queryId },
  } });
});

test('backend health withholds dependency error details', async () => {
  const result = await backendHealth(async () => { throw new Error('secret-key'); }, revision);
  assert.deepEqual(result.body, { status: 'unavailable', service: 'saarthi-web-backend' });
});

test('backend health rejects a procedure denial with HTTP 503', async () => {
  const result = await backendHealth(async () => [{ RESULT: { error: 'no_patient_access' } }],
    revision);
  assert.equal(result.statusCode, 503);
});

test('backend health requires a real statement ID', async () => {
  const result = await backendHealth(async () => [{ RESULT: { rows: [] } }], revision);
  assert.equal(result.statusCode, 503);
});
