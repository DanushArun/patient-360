/**
 * @param {string} requestPatientId
 * @param {string} currentPatientId
 * @param {AbortSignal} signal
 * @returns {boolean}
 */
export function isCurrentPatientRequest(requestPatientId, currentPatientId, signal) {
  return requestPatientId === currentPatientId && !signal.aborted;
}
