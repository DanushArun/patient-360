/**
 * Read-only queue projection of the existing recorded SQL results.
 * Never attach a familiar name to an unrelated legacy fixture patient ID.
 * Workflow state and ownership are absent from this source, so stay unknown.
 */
export function buildReviewQueuePreview(recorded) {
  if (!recorded?.recorded_at || !Array.isArray(recorded.rows)) {
    throw new Error('review_queue_snapshot_unavailable');
  }
  const recordedDay = Date.parse(`${recorded.recorded_at.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(recordedDay)) throw new Error('review_queue_snapshot_invalid_date');
  const patients = new Map();
  const issues = new Map();
  for (const row of recorded.rows) {
    if (!row.patient_id || !row.name?.trim() || !row.encounter_id || !row.rule_id) {
      throw new Error('review_queue_snapshot_missing_identity');
    }
    const existing = patients.get(row.patient_id);
    if (existing && existing.name !== row.name) {
      throw new Error('review_queue_snapshot_identity_conflict');
    }
    patients.set(row.patient_id, { id: row.patient_id, name: row.name });
    if (row.outcome === 'pass') continue;
    if (!['fail', 'conflicting', 'not_evaluated'].includes(row.outcome)
      || !['blocker', 'advisory'].includes(row.severity)) {
      throw new Error('review_queue_snapshot_invalid_result');
    }
    const visitDay = Date.parse(`${row.scheduled?.slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(visitDay)) throw new Error('review_queue_snapshot_invalid_date');
    // This is a display key for a recorded result, not a persisted REVIEW_ISSUE ID.
    const key = `${row.encounter_id}:${row.rule_id}:v${row.rule_version}`;
    const issue = {
      issue_id: key, patient_id: row.patient_id, patient_name: row.name,
      gate: row.gate, rule_id: row.rule_id, rule_version: row.rule_version,
      outcome: row.outcome, severity: row.severity, reason: row.reason,
      scheduled: row.scheduled, days_to_visit: Math.round((visitDay - recordedDay) / 86400000),
      state: null, owner_practitioner_name: null,
    };
    if (issues.has(key) && JSON.stringify(issues.get(key)) !== JSON.stringify(issue)) {
      throw new Error('review_queue_snapshot_result_conflict');
    }
    issues.set(key, issue);
  }
  return {
    recordedAt: recorded.recorded_at,
    patients: [...patients.values()].sort((a, b) => a.name.localeCompare(b.name)),
    issues: [...issues.values()].sort((a, b) => a.days_to_visit - b.days_to_visit
      || Number(b.severity === 'blocker') - Number(a.severity === 'blocker')
      || a.patient_name.localeCompare(b.patient_name) || a.rule_id.localeCompare(b.rule_id)),
  };
}
