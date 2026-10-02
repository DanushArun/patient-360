const TIMESTAMP = new RegExp([
  "^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2}):(\\d{2})",
  "(?:\\.\\d+)?(Z|[+-]\\d{2}:\\d{2})?$",
].join(""));

/** @param {string | null | undefined} value */
/** @returns {string} */
export function formatRecordDate(value) {
  const match = TIMESTAMP.exec(value ?? "");
  if (!match) return "Date unavailable";
  const [, yearText, monthText, dayText, hour, minute, second, zone] = match;
  const [year, month, day] = [yearText, monthText, dayText].map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day || Number(hour) > 23 || Number(minute) > 59
    || Number(second) > 59 || !validZone(zone)) return "Date unavailable";
  const label = new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(date);
  const clock = `${hour}:${minute}:${second}`;
  if (!zone) return `${label}, ${clock} (timezone not supplied)`;
  const offset = zone === "Z" ? "UTC" : `UTC${zone}`;
  return `${label}, ${clock} ${offset}`;
}

/** @param {string | undefined} zone */
/** @returns {boolean} */
function validZone(zone) {
  if (!zone || zone === "Z") return true;
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(zone);
  if (!match) return false;
  const [, , hour, minute] = match;
  return Number(hour) <= 23 && Number(minute) <= 59;
}
