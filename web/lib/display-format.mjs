const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'June', 'July', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec',
];

/**
 * Formats a raw clock/timestamp string into a natural, human-readable label.
 * @param {string | null | undefined} value
 * @returns {string}
 */
export function formatClock(value) {
  if (!value || typeof value !== 'string') return 'Not recorded';
  const trimmed = value.trim();

  // Date only: YYYY-MM-DD
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    const month = MONTHS[Number(m) - 1];
    if (!month) return 'Not recorded';
    return `${Number(d)} ${month} ${y}`;
  }

  // Full timestamp: YYYY-MM-DD[T ]HH:MM:SS...
  const match = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.exec(trimmed);
  if (!match) return 'Not recorded';

  const [, y, m, d, hh, mm, , zone] = match;
  const month = MONTHS[Number(m) - 1];
  if (!month) return 'Not recorded';

  const datePart = `${Number(d)} ${month} ${y}`;
  const timePart = `${hh}:${mm}`;

  if (!zone) return `${datePart}, ${timePart}`;
  const zoneLabel = zone === 'Z' ? 'UTC' : `UTC${zone}`;
  return `${datePart}, ${timePart} ${zoneLabel}`;
}

/**
 * Replaces embedded ISO timestamps in prose text with humanized clocks.
 * @param {string | null | undefined} text
 * @returns {string}
 */
export function humanizeClocks(text) {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\b(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\b/g, (stamp) => {
    const formatted = formatClock(stamp);
    return formatted === 'Not recorded' ? stamp : formatted;
  });
}
