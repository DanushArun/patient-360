/** @param {string} patientId @param {string} taskId @returns {string} */
export function taskUpdateKey(patientId, taskId) {
  return `saarthi:task-update:v1:${encodeURIComponent(patientId)}|${encodeURIComponent(taskId)}`;
}

/** @param {Storage} storage @param {string} key @param {string} taskId
 * @returns {{attempt: {payload: string, id: string}|null, error: boolean}} */
export function readTaskUpdate(storage, key, taskId) {
  try {
    const raw = storage.getItem(key);
    if (!raw) return { attempt: null, error: false };
    const value = JSON.parse(raw);
    if (!validAttempt(value, taskId)) return { attempt: null, error: true };
    return { attempt: value, error: false };
  } catch {
    return { attempt: null, error: true };
  }
}

/** @param {unknown} value @param {string} taskId @returns {boolean} */
function validAttempt(value, taskId) {
  if (!value || typeof value !== 'object' || typeof value.payload !== 'string'
    || typeof value.id !== 'string' || !/^[a-f\d-]{36}$/i.test(value.id)) return false;
  const payload = JSON.parse(value.payload);
  return payload?.taskId === taskId && ['acknowledge', 'reassign', 'resolve'].includes(payload.action)
    && (payload.ownerId === null || typeof payload.ownerId === 'string')
    && typeof payload.reason === 'string' && payload.reason.trim().length >= 3
    && payload.reason.length <= 2000 && Number.isInteger(payload.version);
}

/** @param {Storage} storage @param {string} key
 * @param {{payload: string, id: string}|null} attempt @returns {boolean} */
export function storeTaskUpdate(storage, key, attempt) {
  try {
    if (attempt) storage.setItem(key, JSON.stringify(attempt));
    else storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
