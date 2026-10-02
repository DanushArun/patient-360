import test from 'node:test';
import assert from 'node:assert/strict';
import { formatRecordDate } from './workspace-record-date.mjs';

test('test_record_date_when_timestamp_has_no_zone_keeps_local_clock_unqualified', () => {
  assert.equal(
    formatRecordDate('2026-09-23T14:14:48'),
    '23 Sept 2026, 14:14:48 (timezone not supplied)',
  );
});

test('test_record_date_when_timestamp_has_zone_shows_supplied_offset', () => {
  assert.equal(
    formatRecordDate('2026-09-23T14:14:48+05:30'),
    '23 Sept 2026, 14:14:48 UTC+05:30',
  );
});

test('test_record_date_when_timezone_offset_is_invalid_shows_unavailable', () => {
  assert.equal(formatRecordDate('2026-09-23T14:14:48+25:00'), 'Date unavailable');
});

test('test_record_date_when_timestamp_is_invalid_shows_unavailable', () => {
  assert.equal(formatRecordDate('not-a-timestamp'), 'Date unavailable');
});

test('test_record_date_when_calendar_or_clock_values_are_invalid_shows_unavailable', () => {
  assert.equal(formatRecordDate('2026-02-30T14:14:48'), 'Date unavailable');
  assert.equal(formatRecordDate('2026-09-23T25:14:48'), 'Date unavailable');
});
