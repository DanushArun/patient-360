// Human-readable clocks (INTERFACE-GUIDELINES §6). Raw ISO strings never appear in prose;
// the exact stamp stays available through <time dateTime title> where it is rendered.

const STAMP = /(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?/;
const MONTH = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

/** "2026-09-23T14:14:48" -> "23 Sept 2026, 14:14". Date-only values keep no time. */
export function formatClock(value) {
  const match = typeof value === "string" ? STAMP.exec(value) : null;
  if (!match || match.index !== 0) return "Not recorded";
  const [, year, month, day, hour, minute, , zone] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
    return "Not recorded";
  }
  const label = `${Number(day)} ${MONTH.format(date)} ${year}`;
  if (!hour) return label;
  const suffix = zone === "Z" ? " UTC" : zone ? ` UTC${zone}` : "";
  return `${label}, ${hour}:${minute}${suffix}`;
}

/** Rewrites ISO stamps embedded in record text (rule reasons, notices). */
export function humanizeClocks(text) {
  if (typeof text !== "string") return "";
  return text.replace(new RegExp(STAMP.source, "g"), (stamp) => formatClock(stamp));
}
