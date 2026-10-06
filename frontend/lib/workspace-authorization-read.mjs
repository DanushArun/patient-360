/** @param {string} patientId @param {string | null} cutoff @param {number} attempt */
export function coverageRequestKey(patientId, cutoff, attempt) {
  return JSON.stringify([patientId, cutoff, attempt]);
}

/** @param {{key: string, state: string, data: object | null}} result @param {string} key */
export function coverageResultForKey(result, key) {
  return result.key === key ? result : { key, state: "loading", data: null };
}

/** @param {unknown} payload @returns {object | null} */
export function coverageRowFromEnvelope(payload) {
  if (!isRecord(payload) || !Array.isArray(payload.rows)) return null;
  const row = payload.rows[0];
  return isRecord(row) ? row : null;
}

/** @param {unknown} letter @param {string} patientId
 * @param {string | null} cutoff @param {string} [destination] @returns {string | null}
 */
export function authorizationSourceHref(letter, patientId, cutoff, destination = "coverage") {
  if (!isRecord(letter)) return null;
  if (![letter.page_index, letter.char_start, letter.char_end].every(Number.isSafeInteger)) {
    return null;
  }
  const pageIndex = Number(letter.page_index);
  const start = Number(letter.char_start);
  const end = Number(letter.char_end);
  if (!letter.doc_id || !Number.isInteger(pageIndex) || pageIndex < 0 || !cutoff
    || letter.source_link_status !== "verified_assertion_exact_page_span"
    || !Number.isInteger(start) || !Number.isInteger(end)
    || start < 0 || end <= start) return null;
  const params = new URLSearchParams({ page: String(pageIndex),
    known_as_of: cutoff, return: destination === "coverage-comparison"
      ? "coverage-comparison" : "coverage" });
  params.set("start", String(start));
  params.set("end", String(end));
  return `/patient/${encodeURIComponent(patientId)}/documents/`
    + `${encodeURIComponent(String(letter.doc_id))}?${params}`;
}

/** @param {unknown} letter */
export function authorizationExcerptSpan(letter) {
  if (!isRecord(letter)) return null;
  if (letter.source_link_status !== "verified_assertion_exact_page_span"
    || letter.verification_status !== "verified" || typeof letter.excerpt !== "string"
    || ![letter.char_start, letter.char_end, letter.excerpt_start]
      .every(Number.isSafeInteger)) return null;
  const start = Number(letter.char_start);
  const end = Number(letter.char_end);
  if (start < 0 || end <= start) return null;
  const excerptStart = Number(letter.excerpt_start);
  if (excerptStart < 0 || excerptStart > start) return null;
  const relativeStart = start - excerptStart;
  const length = end - start;
  const excerpt = letter.excerpt;
  if (excerpt.length < relativeStart + length) return null;
  return { before: excerpt.slice(0, relativeStart),
    cited: excerpt.slice(relativeStart, relativeStart + length),
    after: excerpt.slice(relativeStart + length) };
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
