/** @param {{getItem: (key: string) => string | null}} storage
 * @param {string[]} availableDates @returns {object} */
export function readWorklistState(storage, availableDates = []) {
  const view = storage.getItem('sa-daycare-view');
  const scroll = Number(storage.getItem('sa-daycare-scroll'));
  const storedDate = storage.getItem('sa-daycare-date') ?? '';
  const selectedDate = availableDates.includes(storedDate)
    ? storedDate : availableDates[0] ?? '';
  const dateRange = storage.getItem('sa-daycare-date-range');
  return { search: storage.getItem('sa-daycare-search') ?? '',
    view: view === 'visits' ? 'visits' : 'state',
    scroll: Number.isFinite(scroll) && scroll > 0 ? scroll : 0,
    selectedDate,
    dateRange: dateRange === 'next7' ? 'next7' : 'date' };
}
/** @param {{setItem: (key: string, value: string) => void}} storage
 * @param {{search: string, view: string, scroll: number, selectedDate: string,
 * dateRange: string}} state @returns {void} */
export function saveWorklistState(storage, state) {
  storage.setItem('sa-daycare-search', state.search);
  storage.setItem('sa-daycare-view', state.view);
  storage.setItem('sa-daycare-scroll', String(state.scroll));
  storage.setItem('sa-daycare-date', state.selectedDate);
  storage.setItem('sa-daycare-date-range', state.dateRange);
}
