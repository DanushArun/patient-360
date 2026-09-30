/** Evaluate SQL probe results. null denotes an informational inventory. */
export function evaluateProbe(probeId, rows) {
  if (probeId === 1) return rows.length === 16;
  if ([2, 5].includes(probeId)) return rows.length === 0;
  if (probeId === 3 || probeId === 4) {
    const column = probeId === 3 ? 'DANGLING_BINDINGS' : 'MISSING_CLOCKS';
    return rows.length === 1 && rows[0][column] === 0;
  }
  if (probeId === 6) return null;
  if (probeId === 7) {
    const outcomes = new Set(rows.map(row => row.OUTCOME));
    return outcomes.size === 4 &&
      ['pass', 'fail', 'not_evaluated', 'conflicting'].every(value => outcomes.has(value));
  }
  if (probeId === 8) return rows.length >= 1;
  return false;
}
