export const familyLanguages = Object.freeze({
  en: 'English',
  hi: 'हिन्दी',
  ta: 'தமிழ்',
  bn: 'বাংলা',
  mr: 'मराठी',
});

/**
 * @param {unknown} gates
 * @returns {{items: Array<{ruleId: string|null, status: string, reason: string|null}>,
 *   available: boolean, allReturnedPassed: boolean, message: string}}
 */
export function familyRecord(gates) {
  const items = Array.isArray(gates) ? gates.map(recordGate) : [];
  const available = items.length > 0;
  const allReturnedPassed = available && items.every((item) => item.status === 'pass');
  return {
    items,
    available,
    allReturnedPassed,
    message: allReturnedPassed
      ? 'All returned checks passed. Confirm the visit with the treating team.'
      : available
        ? 'Readiness requires navigator review. Confirm the visit with the treating team.'
        : 'Readiness results unavailable. Check the record with the treating team.',
  };
}

/**
 * @param {unknown} gate
 * @returns {{ruleId: string|null, status: string, reason: string|null}}
 */
function recordGate(gate) {
  const status = typeof gate?.outcome === 'string' ? gate.outcome : 'unavailable';
  return {
    ruleId: typeof gate?.rule_id === 'string' ? gate.rule_id : null,
    status,
    reason: typeof gate?.reason === 'string' ? gate.reason : null,
  };
}
