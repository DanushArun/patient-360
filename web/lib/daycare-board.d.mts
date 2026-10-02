import type { Chair } from "./census";

export function getAvailableVisitDates(groups: { day: string; chairs: Chair[] }[]): string[];
export function filterDayCareVisits(
  groups: { day: string; chairs: Chair[] }[],
  selectedDate: string,
  query: string,
): Chair[];
