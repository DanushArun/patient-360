export type WorklistState = {
  search: string;
  view: 'state' | 'visits';
  scroll: number;
  selectedDate: string;
  dateRange: 'date' | 'next7';
};
export function readWorklistState(
  storage: Pick<Storage, 'getItem'>, availableDates?: string[],
): WorklistState;
export function saveWorklistState(
  storage: Pick<Storage, 'setItem'>, state: WorklistState,
): void;
