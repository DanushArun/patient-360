import test from 'node:test';
import assert from 'node:assert/strict';
import { readWorklistState, saveWorklistState } from './worklist-storage.mjs';

function storage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value) };
}
test('test_worklist_when_restored_preserves_view_filter_and_scroll', () => {
  assert.deepEqual(readWorklistState(storage({ 'sa-daycare-search': 'synthetic',
    'sa-daycare-view': 'visits', 'sa-daycare-scroll': '340',
    'sa-daycare-date': '2026-10-03', 'sa-daycare-date-range': 'next7' }),
    ['2026-10-03', '2026-10-04']),
    { search: 'synthetic', view: 'visits', scroll: 340,
      selectedDate: '2026-10-03', dateRange: 'next7' });
});
test('test_worklist_when_values_invalid_uses_safe_defaults', () => {
  assert.deepEqual(readWorklistState(storage({ 'sa-daycare-view': 'bad',
    'sa-daycare-scroll': '-5', 'sa-daycare-date-range': 'invalid' }),
    ['2026-10-04']), { search: '', view: 'state', scroll: 0,
    selectedDate: '2026-10-04', dateRange: 'date' });
});
test('test_worklist_when_saved_round_trips_current_state', () => {
  const local = storage();
  const state = { search: 'CBC', view: 'visits', scroll: 125,
    selectedDate: '2026-10-03', dateRange: 'next7' };
  saveWorklistState(local, state);
  assert.deepEqual(readWorklistState(local, ['2026-10-03']), state);
});
test('test_worklist_when_saved_date_is_obsolete_uses_first_available_date', () => {
  const local = storage({ 'sa-daycare-date': '2026-10-01' });
  assert.equal(readWorklistState(local, ['2026-10-03']).selectedDate, '2026-10-03');
});
test('test_worklist_when_no_dates_are_available_uses_empty_date', () => {
  assert.equal(readWorklistState(storage({ 'sa-daycare-date': 'old' })).selectedDate, '');
});
test('test_worklist_when_storage_denied_reports_failure', () => {
  assert.throws(() => readWorklistState({ getItem: () => { throw new Error('denied'); } }),
    /denied/);
});
