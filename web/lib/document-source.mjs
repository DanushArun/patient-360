/** @param {unknown} value @returns {boolean} */
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    return false;
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed > Date.now()) return false;
  return new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10)
    === value.slice(0, 10);
}

/** @param {string} docId @param {Record<string, string|undefined>} query @returns {object} */
export function documentRequest(docId, query) {
  if (!/^[A-Za-z0-9_-]{1,160}$/.test(docId)) throw new Error('source_invalid');
  const page = Number(query.page ?? '0');
  if (!Number.isInteger(page) || page < 0 || page > 9999) throw new Error('source_invalid');
  const cutoff = query.known_as_of;
  if (cutoff !== undefined && !timestamp(cutoff)) throw new Error('source_invalid');
  return { docId, page, cutoff: cutoff ?? null, start: query.start, end: query.end,
    argument: cutoff ? `${docId}|${cutoff}` : docId };
}

/** @param {string} patientId @param {string|undefined} destination @returns {string} */
export function documentReturn(patientId, destination) {
  const path = `/patient/${encodeURIComponent(patientId)}`;
  if (destination === 'ask') return `${path}#ask-record`;
  const sections = new Set(['facts', 'timeline', 'documents', 'coverage', 'coverage-comparison', 'review', 'family']);
  return sections.has(destination) ? `${path}#${destination}` : path;
}

/** @param {Record<string, unknown>[]} rows @param {object} request @returns {object} */
export function readDocumentPage(rows, request) {
  const row = rows.find((item) => item.PAGE_INDEX === request.page);
  if (!row) throw new Error('source_unavailable');
  if (row.DOC_ID !== request.docId || row.SCOPE !== 'patient' || typeof row.TEXT !== 'string'
      || !Number.isInteger(row.VERSION) || row.VERSION < 1) throw new Error('source_invalid');
  if (request.cutoff && (!timestamp(row.INGESTED_AT)
      || Date.parse(row.INGESTED_AT) > Date.parse(request.cutoff))) {
    throw new Error('source_invalid');
  }
  return { docId: row.DOC_ID, page: row.PAGE_INDEX, version: row.VERSION, text: row.TEXT,
    eventTime: row.EVENT_TIME ?? null, recordedAt: row.SOURCE_RECORDED_AT ?? null,
    ingestedAt: row.INGESTED_AT ?? null, currentStatus: row.DOCUMENT_STATUS ?? null,
    statusObservedAt: row.STATUS_OBSERVED_AT ?? null,
    highlight: sourceHighlight(row.TEXT, request) };
}

/** @param {string} content @param {object} request @returns {object|null} */
function sourceHighlight(content, request) {
  if (request.start === undefined && request.end === undefined) return null;
  if (!/^\d+$/.test(request.start ?? '') || !/^\d+$/.test(request.end ?? '')) {
    throw new Error('source_invalid');
  }
  const start = Number(request.start), end = Number(request.end);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
      || end <= start || end > content.length) throw new Error('source_invalid');
  return { before: content.slice(0, start), cited: content.slice(start, end),
    after: content.slice(end) };
}
