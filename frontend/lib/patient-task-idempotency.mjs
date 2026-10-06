const TASK_REQUEST_PREFIX = "saarthi:review-task:v1:";

/** @param {string} patientId @param {string} ruleId @param {string} action
 * @returns {string}
 */
export function patientTaskStorageKey(patientId, ruleId, action) {
  const patient = encodeURIComponent(patientId);
  const rule = encodeURIComponent(ruleId);
  return `${TASK_REQUEST_PREFIX}${patient}|${rule}|${action}`;
}

/** @param {Map<string, string>} attempts @param {string} key
 * @param {() => string} createId @param {() => Storage} getStorage
 * @returns {{requestId: string, persistenceAvailable: boolean}}
 */
export function restoreOrCreateTaskRequest(attempts, key, createId, getStorage) {
  const existing = attempts.get(key);
  try {
    const storage = getStorage();
    const stored = storage.getItem(key);
    const requestId = existing ?? (stored?.trim() ? stored : createId());
    attempts.set(key, requestId);
    storage.setItem(key, requestId);
    return { requestId, persistenceAvailable: true };
  } catch {
    const requestId = existing ?? createId();
    attempts.set(key, requestId);
    return { requestId, persistenceAvailable: false };
  }
}

/** @param {Map<string, string>} attempts @param {string} key
 * @param {() => Storage} [getStorage] @returns {boolean}
 */
export function confirmTaskRequest(attempts, key, getStorage) {
  attempts.delete(key);
  if (!getStorage) return true;
  try {
    getStorage().removeItem(key);
    return true;
  } catch {
    try {
      getStorage().setItem(key, "");
      return true;
    } catch {
      return false;
    }
  }
}

/** @param {Map<string, string>} attempts @param {string} patientId
 * @param {() => Storage} getStorage @returns {boolean}
 */
export function purgePatientTaskRequests(attempts, patientId, getStorage) {
  const prefix = `${TASK_REQUEST_PREFIX}${encodeURIComponent(patientId)}|`;
  for (const key of attempts.keys()) {
    if (key.startsWith(prefix)) attempts.delete(key);
  }
  try {
    const storage = getStorage();
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index));
    let succeeded = true;
    for (const key of keys) {
      if (!key?.startsWith(prefix)) continue;
      try {
        storage.removeItem(key);
      } catch {
        succeeded = false;
      }
    }
    return succeeded;
  } catch {
    return false;
  }
}

/** @param {unknown} receipt
 * @returns {{taskId: string, state: string, replay: boolean | undefined} | null}
 */
export function confirmedTaskReceipt(receipt) {
  const states = ["open", "acknowledged", "resolved", "closed", "cancelled"];
  if (typeof receipt !== "object" || receipt === null) return null;
  const value = /** @type {Record<string, unknown>} */ (receipt);
  if (value.read_back_confirmed !== true || typeof value.task_id !== "string"
    || !value.task_id.trim() || typeof value.state !== "string" || !states.includes(value.state)) {
    return null;
  }
  return { taskId: value.task_id, state: value.state,
    replay: typeof value.idempotent_replay === "boolean"
      ? value.idempotent_replay : undefined };
}
