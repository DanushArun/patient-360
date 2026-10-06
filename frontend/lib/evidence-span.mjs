/** Snowflake/Python text spans use Unicode code points, not JS UTF-16 units.
 * Missing/invalid ranges must show the page without fabricating an exact span.
 * Inputs remain scoped by the existing server-side patient procedure.
 */
export function evidenceSpan(text, rawStart, rawEnd) {
  const none = (reason) => ({ kind: "page", reason, before: text, highlight: "", after: "" });
  const absent = (v) => v === undefined || v === null;
  if (absent(rawStart) && absent(rawEnd)) return none("no_span");
  const integer = (v) => typeof v === "number" ? Number.isSafeInteger(v) && v >= 0
    : typeof v === "string" && /^(0|[1-9][0-9]*)$/.test(v) && Number.isSafeInteger(Number(v));
  if (!integer(rawStart) || !integer(rawEnd)) return none("invalid_span");
  const start = Number(rawStart), end = Number(rawEnd);
  const chars = Array.from(text);
  if (start >= end || end > chars.length) return none("invalid_span");
  if (start === 0 && end === chars.length) return none("whole_page");
  return { kind: "span", reason: null, before: chars.slice(0, start).join(""),
    highlight: chars.slice(start, end).join(""), after: chars.slice(end).join("") };
}
