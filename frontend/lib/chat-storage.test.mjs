import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readStoredTurns, writeStoredTurns } from './chat-storage.mjs';

const validTurn = {
  id: 'turn-1', role: 'user', text: 'Find the report', thinking: '', tools: [],
  suggested: [], gates: [], known_as_of: null, error: null,
};

/** @param {string} name @returns {object} */
function artifactFixture(name) {
  return JSON.parse(readFileSync(new URL(`../../frontend/fixtures/${name}.json`, import.meta.url)));
}

test('test_stored_turns_when_json_is_null_returns_empty_turns', () => {
  const result = readStoredTurns({ getItem: () => 'null' }, 'turns');

  assert.deepEqual(result.turns, []);
});

test('test_stored_turns_when_json_is_object_returns_empty_turns', () => {
  const result = readStoredTurns({ getItem: () => '{"turns":[]}' }, 'turns');

  assert.deepEqual(result.turns, []);
});

test('test_stored_turns_when_array_has_invalid_entries_returns_empty_turns', () => {
  const result = readStoredTurns({ getItem: () => '[null]' }, 'turns');

  assert.deepEqual(result.turns, []);
});

test('test_stored_turns_when_json_is_malformed_returns_error_and_empty_turns', () => {
  const result = readStoredTurns({ getItem: () => '{bad json' }, 'turns');

  assert.deepEqual(result.turns, []);
  assert.ok(result.error instanceof SyntaxError);
});

test('test_stored_turns_when_turn_fields_are_invalid_returns_empty_turns', () => {
  const result = readStoredTurns({ getItem: () => '[{"id":2,"role":"user","text":"x"}]' }, 'turns');

  assert.deepEqual(result.turns, []);
});

test('test_stored_turns_when_assistant_fields_are_missing_returns_empty_turns', () => {
  const turn = { ...validTurn, role: 'assistant', suggested: undefined, gates: undefined };
  const result = readStoredTurns({ getItem: () => JSON.stringify([turn]) }, 'turns');

  assert.deepEqual(result.turns, []);
});

test('test_stored_turns_when_nested_gate_is_null_returns_empty_turns', () => {
  const turn = { ...validTurn, role: 'assistant', gates: [null] };
  const result = readStoredTurns({ getItem: () => JSON.stringify([turn]) }, 'turns');

  assert.deepEqual(result.turns, []);
});

test('test_stored_turns_when_suggested_item_is_invalid_returns_empty_turns', () => {
  const turn = { ...validTurn, role: 'assistant', suggested: [null] };
  const result = readStoredTurns({ getItem: () => JSON.stringify([turn]) }, 'turns');

  assert.deepEqual(result.turns, []);
});

test('test_stored_turns_when_assistant_has_valid_artifact_preserves_turn', () => {
  const turn = {
    ...validTurn,
    role: 'assistant',
    artifact: artifactFixture('answer_supported'),
  };
  const result = readStoredTurns({ getItem: () => JSON.stringify([turn]) }, 'turns');

  assert.deepEqual(result.turns, [turn]);
});

for (const name of ['answer_class_a', 'answer_conflicting', 'answer_supported']) {
  test(`test_stored_${name}_when_written_restores_exact_artifact`, () => {
    let content = null;
    const storage = { setItem: (_key, value) => { content = value; }, getItem: () => content };
    const turn = { ...validTurn, role: 'assistant', artifact: artifactFixture(name) };
    writeStoredTurns(storage, 'turns', [turn]);
    assert.deepEqual(readStoredTurns(storage, 'turns').turns, [turn]);
  });
}

test('test_stored_artifact_when_cutoff_is_missing_rejects_unsupported_answer', () => {
  const artifact = { ...artifactFixture('answer_supported'), known_as_of: null };
  const turn = { ...validTurn, role: 'assistant', artifact };
  assert.deepEqual(readStoredTurns({ getItem: () => JSON.stringify([turn]) }, 'turns').turns, []);
});

test('test_stored_artifact_when_citation_is_missing_rejects_unsupported_answer', () => {
  const artifact = { ...artifactFixture('answer_supported'),
    claims: [{ text: 'Report received', evidence: {} }] };
  const turn = { ...validTurn, role: 'assistant', artifact };
  assert.deepEqual(readStoredTurns({ getItem: () => JSON.stringify([turn]) }, 'turns').turns, []);
});

for (const field of ['rule_id', 'reason', 'known_as_of']) {
  test(`test_stored_gate_when_${field}_is_object_rejects_unrenderable_turn`, () => {
    const gate = { gate: 'labs', outcome: 'fail', [field]: {} };
    const turn = { ...validTurn, role: 'assistant', gates: [gate] };
    assert.deepEqual(readStoredTurns({ getItem: () => JSON.stringify([turn]) }, 'turns').turns, []);
  });
}

test('test_stored_turns_when_json_is_valid_returns_turns', () => {
  const result = readStoredTurns({ getItem: () => JSON.stringify([validTurn]) }, 'turns');

  assert.deepEqual(result.turns, [validTurn]);
});

test('test_stored_turns_when_storage_read_is_denied_returns_error_and_empty_turns', () => {
  const result = readStoredTurns({ getItem: () => { throw new Error('denied'); } }, 'turns');

  assert.deepEqual(result.turns, []);
  assert.match(result.error.message, /denied/);
});

test('test_stored_turns_when_storage_write_hits_quota_returns_error', () => {
  const storage = { setItem: () => { throw new Error('quota'); } };
  const result = writeStoredTurns(storage, 'turns', [validTurn]);

  assert.match(result.error.message, /quota/);
});

test('test_stored_turns_when_storage_write_is_denied_returns_error', () => {
  const storage = { setItem: () => { throw new Error('denied'); } };
  const result = writeStoredTurns(storage, 'turns', [validTurn]);

  assert.match(result.error.message, /denied/);
});
