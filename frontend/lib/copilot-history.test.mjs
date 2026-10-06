import test from 'node:test';
import assert from 'node:assert/strict';
import { formatHistoryAge, listCopilotHistory, touchCopilotHistory } from './copilot-history.mjs';

const turn = (role, text) => ({ id: `${role}-${text}`, role, text, thinking: '', tools: [],
  suggested: [], gates: [], known_as_of: null, error: null });

test('lists resumable patient conversations by patient and evidence scope', () => {
  const values = new Map([
    ['saarthi-turns:PAT-DC-04:patient', JSON.stringify([turn('user', 'What is missing?')])],
    ['saarthi-turns:PAT-DC-04:reference', JSON.stringify([turn('user', 'Explain the policy')])],
    ['saarthi-turns:PAT-DC-05:patient', JSON.stringify([])],
    ['unrelated', JSON.stringify([turn('user', 'Ignore me')])],
  ]);
  const storage = { get length() { return values.size; }, key: (i) => [...values.keys()][i],
    getItem: (key) => values.get(key) ?? null };
  assert.deepEqual(listCopilotHistory(storage, ['PAT-DC-04', 'PAT-DC-05'], 1000), [
    { patientId: 'PAT-DC-04', scope: 'patient', title: 'What is missing?', storageKey:
      'saarthi-turns:PAT-DC-04:patient', updatedAt: 1000 },
    { patientId: 'PAT-DC-04', scope: 'reference', title: 'Explain the policy', storageKey:
      'saarthi-turns:PAT-DC-04:reference', updatedAt: 1000 },
  ]);
});

test('ignores malformed or unsafe storage entries', () => {
  const values = new Map([['saarthi-turns:PAT-1:patient', '{bad json}'],
    ['saarthi-turns:PAT-2:unknown', JSON.stringify([turn('user', 'unsafe scope')])]]);
  const storage = { get length() { return values.size; }, key: (i) => [...values.keys()][i],
    getItem: (key) => values.get(key) ?? null };
  assert.deepEqual(listCopilotHistory(storage, ['PAT-1', 'PAT-2']), []);
});

test('shows only chats for patients in the current authorized roster', () => {
  const values = new Map([
    ['saarthi-turns:PAT-DC-04:patient', JSON.stringify([turn('user', 'Authorized')])],
    ['saarthi-turns:PAT-DC-05:patient', JSON.stringify([turn('user', 'No longer in scope')])],
  ]);
  const storage = { get length() { return values.size; }, key: (i) => [...values.keys()][i],
    getItem: (key) => values.get(key) ?? null };
  assert.deepEqual(listCopilotHistory(storage, ['PAT-DC-04']).map(({ patientId }) => patientId),
    ['PAT-DC-04']);
});

test('orders conversations by their last updated time without storing message text in the index', () => {
  const values = new Map([
    ['saarthi-turns:PAT-DC-04:patient', JSON.stringify([turn('user', 'Older chat')])],
    ['saarthi-turns:PAT-DC-05:patient', JSON.stringify([turn('user', 'Newer chat')])],
  ]);
  const storage = { get length() { return values.size; }, key: (i) => [...values.keys()][i],
    getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  touchCopilotHistory(storage, 'saarthi-turns:PAT-DC-04:patient', 100);
  touchCopilotHistory(storage, 'saarthi-turns:PAT-DC-05:patient', 200);
  assert.deepEqual(listCopilotHistory(storage, ['PAT-DC-04', 'PAT-DC-05'])
    .map(({ title }) => title), ['Newer chat', 'Older chat']);
  assert.equal(values.get('saarthi-chat-history'), JSON.stringify({
    'saarthi-turns:PAT-DC-04:patient': 100, 'saarthi-turns:PAT-DC-05:patient': 200,
  }));
});

test('formats conversation recency as compact relative time', () => {
  const now = 1_800_000_000_000;
  assert.equal(formatHistoryAge(now - 4_000, now), '4s ago');
  assert.equal(formatHistoryAge(now - 8 * 60 * 60_000, now), '8h ago');
  assert.equal(formatHistoryAge(now - 24 * 60 * 60_000, now), '1d ago');
  assert.equal(formatHistoryAge(now + 60_000, now), '0s ago');
  assert.equal(formatHistoryAge(0, now), '0s ago');
  assert.equal(formatHistoryAge(now - 8 * 24 * 60 * 60_000, now), '8d ago');
});

test('migrates untimed chats once without using their clinical evidence clocks', () => {
  const values = new Map([['saarthi-turns:PAT-1:patient', JSON.stringify([
    turn('user', 'Previous question'), { ...turn('assistant', 'Previous answer'),
      known_as_of: '2020-01-01T00:00:00Z' },
  ])]]);
  const storage = { get length() { return values.size; }, key: (i) => [...values.keys()][i],
    getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  assert.equal(listCopilotHistory(storage, ['PAT-1'], 1000)[0].updatedAt, 1000);
  assert.equal(listCopilotHistory(storage, ['PAT-1'], 5000)[0].updatedAt, 1000);
});
