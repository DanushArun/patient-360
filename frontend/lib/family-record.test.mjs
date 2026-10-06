import test from 'node:test';
import assert from 'node:assert/strict';
import { familyRecord } from './family-record.mjs';

test('family_record_when_gate_is_unknown_preserves_source_outcome_and_reason', () => {
  const result = familyRecord([{
    rule_id: 'NEW-RULE-9', outcome: 'blocked', reason: 'Review source',
  }]);
  assert.deepEqual(result.items, [{
    ruleId: 'NEW-RULE-9', status: 'blocked', reason: 'Review source',
  }]);
  assert.equal(result.allReturnedPassed, false);
});

test('family_record_when_gate_reason_is_missing_marks_review_without_inventing_reason', () => {
  const result = familyRecord([{ rule_id: 'R-1', outcome: 'not_evaluated' }]);
  assert.deepEqual(result.items, [{ ruleId: 'R-1', status: 'not_evaluated', reason: null }]);
  assert.equal(result.available, true);
});

test('family_record_when_all_returned_gates_pass_scopes_clear_message', () => {
  const result = familyRecord([{ rule_id: 'R-1', outcome: 'pass', reason: 'Met' }]);
  assert.equal(result.allReturnedPassed, true);
  assert.equal(result.message,
    'All returned checks passed. Confirm the visit with the treating team.');
});

test('family_record_when_no_gates_are_returned_reports_unavailable', () => {
  const result = familyRecord([]);
  assert.equal(result.available, false);
  assert.match(result.message, /Readiness results unavailable/i);
});

test('family_record_never_derives_cbc_timing_or_test_orders_from_gate_text', () => {
  const result = familyRecord([{
    rule_id: 'CLIN-ANC-001', outcome: 'fail', reason: 'CBC is 8 days old',
  }]);
  assert.deepEqual(result.items[0], {
    ruleId: 'CLIN-ANC-001', status: 'fail', reason: 'CBC is 8 days old',
  });
  assert.doesNotMatch(result.message, /CBC|days|test|lab|order/i);
});
