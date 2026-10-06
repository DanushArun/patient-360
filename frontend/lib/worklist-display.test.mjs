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

test("visit slot reads on one line and omits the current year", async () => {
  const { formatVisitSlot } = await import("./worklist-display.mjs");
  const now = new Date("2026-10-05T08:00:00Z");
  assert.equal(formatVisitSlot("2026-10-05T09:30:00", now), "Mon 5 Oct · 09:30");
  assert.equal(formatVisitSlot("2027-01-04T14:00:00", now), "Mon 4 Jan 2027 · 14:00");
  assert.equal(formatVisitSlot("2026-10-05", now), "Mon 5 Oct · time not recorded");
  assert.equal(formatVisitSlot("garbage", now), "Date unavailable");
});
