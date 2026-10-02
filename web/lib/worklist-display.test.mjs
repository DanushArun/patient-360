import test from 'node:test';
import assert from 'node:assert/strict';
import { formatVisitDate } from './worklist-display.mjs';

test('test_visit_date_when_scheduled_value_has_date_date_label_is_included', () => {
  const label = formatVisitDate('2026-09-23T14:14:48');
  assert.ok(label.includes('23') && label.includes('2026') && label.includes('Wed'));
});

test('test_visit_date_when_scheduled_value_invalid_unavailable_label_is_shown', () => {
  assert.equal(formatVisitDate('not-a-date'), 'Date unavailable');
});
