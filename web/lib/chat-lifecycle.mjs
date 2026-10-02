/** @param {{activeRequest: {current: AbortController | null}, sequence: {current: number}}} refs */
export function invalidateChatRequest({ activeRequest, sequence }) {
  activeRequest.current?.abort();
  activeRequest.current = null;
  sequence.current += 1;
}

/** @param {{patientId: string, storageKey: string, activePatient: {current: string},
 * activeStorageKey: {current: string}, activeRequest: {current: AbortController | null},
 * sequence: {current: number}, lastQuestions: {current: object}}} context @returns {boolean} */
export function updateChatContext(context) {
  const patientChanged = context.activePatient.current !== context.patientId;
  const keyChanged = context.activeStorageKey.current !== context.storageKey;
  if (!patientChanged && !keyChanged) return false;
  invalidateChatRequest(context);
  context.activePatient.current = context.patientId;
  context.activeStorageKey.current = context.storageKey;
  if (patientChanged) context.lastQuestions.current = { patient: '', reference: '' };
  return true;
}

/** @param {{removeItem: (key: string) => void}} storage @param {string} patientId */
export function clearPatientTurns(storage, patientId) {
  for (const scope of ['patient', 'reference', 'references']) {
    try {
      storage.removeItem(`saarthi-turns:${patientId}:${scope}`);
    } catch (error) {
      console.error('Could not clear stored patient conversation.', error);
    }
  }
}
