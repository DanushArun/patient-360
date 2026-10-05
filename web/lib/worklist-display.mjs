/** @param {string} scheduled */
export function formatVisitDate(scheduled) {
  const datePart = scheduled.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return 'Date unavailable';
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}

/**
 * One-line visit slot for tables: "Mon 5 Oct · 09:30". The year appears only when it is
 * not the current year. Times are shown as recorded (no time zone is stored).
 * @param {string} scheduled
 * @param {Date} [now]
 */
export function formatVisitSlot(scheduled, now = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(scheduled ?? '');
  if (!match) return 'Date unavailable';
  const [, year, month, day, hour, minute] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCDate() !== Number(day) || date.getUTCMonth() !== Number(month) - 1) {
    return 'Date unavailable';
  }
  const parts = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric',
    month: 'short', timeZone: 'UTC' }).formatToParts(date);
  const pick = (type) => parts.find((part) => part.type === type)?.value ?? '';
  const sameYear = Number(year) === now.getUTCFullYear();
  const label = `${pick('weekday')} ${pick('day')} ${pick('month')}${sameYear ? '' : ` ${year}`}`;
  return `${label} · ${hour ? `${hour}:${minute}` : 'time not recorded'}`;
}
