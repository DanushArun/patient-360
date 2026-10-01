// SQL supplies clinical outcomes. Every read independently checks user scope.
const SCOPE = `WITH patient_scope AS (
  SELECT DISTINCT p.patient_id, p.name
  FROM SAARTHI.CORE.PATIENT p
  JOIN SAARTHI.GOVERNANCE.CARE_TEAM ct ON ct.patient_id = p.patient_id
  JOIN SAARTHI.GOVERNANCE.PRACTITIONER pr ON pr.practitioner_id = ct.practitioner_id
  LEFT JOIN SAARTHI.GOVERNANCE.FACILITY f ON f.facility_id = pr.facility_id
  WHERE UPPER(pr.snowflake_user) = UPPER(CURRENT_USER()) AND pr.active = TRUE
    AND ct.role_type IN ('treating', 'coordinator')
    AND ct.active_from <= CURRENT_DATE()
    AND (ct.active_to IS NULL OR ct.active_to >= CURRENT_DATE())
    AND EXISTS (
      SELECT 1 FROM SAARTHI.GOVERNANCE.CONSENT c
      WHERE c.patient_id = p.patient_id AND c.status = 'active'
        AND c.valid_from <= CURRENT_TIMESTAMP()
        AND (c.valid_until IS NULL OR c.valid_until >= CURRENT_TIMESTAMP())
        AND c.purpose_code IN ('treatment', 'coordination')
        AND (c.granted_to_facility_id = pr.facility_id OR c.granted_to_org_id = f.org_id)
    )
)`;

export const QUEUE_PATIENTS_SQL = `${SCOPE}
SELECT patient_id, name FROM patient_scope ORDER BY name, patient_id`;

// Same visit choice as loadPatientSnapshot: next visit, or latest past visit.
export const QUEUE_READINESS_SQL = `${SCOPE}, selected_visit AS (
  SELECT e.patient_id, e.encounter_id, e.scheduled_time
  FROM SAARTHI.CORE.ENCOUNTER e JOIN patient_scope p ON p.patient_id = e.patient_id
  WHERE e.encounter_type = 'daycare'
  QUALIFY ROW_NUMBER() OVER (PARTITION BY e.patient_id ORDER BY
    IFF(e.scheduled_time >= CURRENT_TIMESTAMP(), 0, 1),
    IFF(e.scheduled_time >= CURRENT_TIMESTAMP(), e.scheduled_time, NULL) ASC NULLS LAST,
    IFF(e.scheduled_time < CURRENT_TIMESTAMP(), e.scheduled_time, NULL) DESC NULLS LAST,
    e.encounter_id) = 1
)
SELECT p.patient_id, p.name, e.encounter_id,
       TO_VARCHAR(e.scheduled_time, 'YYYY-MM-DD"T"HH24:MI:SS') AS scheduled,
       DATEDIFF(day, CURRENT_DATE(), e.scheduled_time) AS days_to_visit,
       rs.gate, rs.rule_id, rs.rule_version, rs.outcome, rs.severity, rs.reason,
       TO_VARCHAR(rs.known_as_of, 'YYYY-MM-DD"T"HH24:MI:SS') AS known_as_of
FROM patient_scope p
LEFT JOIN selected_visit e ON e.patient_id = p.patient_id
LEFT JOIN SAARTHI.OPERATIONAL.READINESS_STATE rs
  ON rs.patient_id = p.patient_id AND rs.encounter_id = e.encounter_id
ORDER BY e.scheduled_time, p.patient_id, rs.gate, rs.rule_id`;

// Read workflow records separately. Both real issue IDs and patient:rule IDs
// used by the existing create-task API resolve to patient IDs, never names.
export const QUEUE_TASKS_SQL = `${SCOPE}, task_subjects AS (
  SELECT rt.*, ri.patient_id, ri.rule_id, ri.encounter_id
  FROM SAARTHI.OPERATIONAL.REVIEW_TASK rt
  JOIN SAARTHI.OPERATIONAL.REVIEW_ISSUE ri ON ri.issue_id = rt.issue_id
  JOIN patient_scope p ON p.patient_id = ri.patient_id
  UNION ALL
  SELECT rt.*, r.patient_id, r.rule_id, NULL AS encounter_id
  FROM SAARTHI.OPERATIONAL.REVIEW_TASK rt
  JOIN (SELECT DISTINCT rs.patient_id, rs.rule_id
        FROM SAARTHI.OPERATIONAL.READINESS_STATE rs
        JOIN patient_scope p ON p.patient_id = rs.patient_id) r
    ON rt.issue_id = r.patient_id || ':' || r.rule_id
  WHERE NOT EXISTS (SELECT 1 FROM SAARTHI.OPERATIONAL.REVIEW_ISSUE ri WHERE ri.issue_id = rt.issue_id)
)
SELECT t.patient_id, t.rule_id, t.encounter_id, t.task_id, t.issue_id,
       t.owner_practitioner_id, owner.name AS owner_name, t.state, t.decision, t.reason,
       TO_VARCHAR(t.created_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at
FROM task_subjects t
LEFT JOIN SAARTHI.GOVERNANCE.PRACTITIONER owner
  ON owner.practitioner_id = t.owner_practitioner_id
ORDER BY t.created_at DESC, t.task_id`;

const OUTCOMES = new Set(['pass', 'fail', 'conflicting', 'not_evaluated']);
const CLOSED_STATES = new Set(['closed', 'resolved', 'cancelled']);

export function buildLiveReviewQueue(patientRows, readinessRows, taskRows) {
  const patients = patientRows.map(row => ({ id: row.PATIENT_ID, name: row.NAME }));
  const scope = new Map(patients.map(patient => [patient.id, patient]));
  if (patients.some(patient => !patient.id || !patient.name) || scope.size !== patients.length) {
    throw new Error('queue_identity_unavailable');
  }
  const tasks = taskRows.map(row => {
    if (!scope.has(row.PATIENT_ID) || !row.TASK_ID || !row.RULE_ID || !row.ISSUE_ID) {
      throw new Error('queue_task_scope_mismatch');
    }
    return {
      taskId: row.TASK_ID, issueId: row.ISSUE_ID, patientId: row.PATIENT_ID,
      ruleId: row.RULE_ID, encounterId: row.ENCOUNTER_ID ?? null,
      ownerId: row.OWNER_PRACTITIONER_ID ?? null, owner: row.OWNER_NAME ?? row.OWNER_PRACTITIONER_ID ?? null,
      state: row.STATE ?? null, action: row.DECISION ?? null, reason: row.REASON ?? null,
      createdAt: row.CREATED_AT ?? null,
    };
  });
  patients.sort((a,b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  tasks.sort((a,b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '') || a.taskId.localeCompare(b.taskId));
  const issues = [], unavailable = [], seen = new Set(), attachedTasks = new Set();
  const ordered = [...readinessRows].sort((a,b) => String(a.SCHEDULED ?? '').localeCompare(String(b.SCHEDULED ?? '')) ||
    String(a.PATIENT_ID).localeCompare(String(b.PATIENT_ID)) || String(a.RULE_ID).localeCompare(String(b.RULE_ID)));
  for (const row of ordered) {
    const patient = scope.get(row.PATIENT_ID);
    if (!patient || patient.name !== row.NAME) throw new Error('queue_readiness_scope_mismatch');
    if (!row.RULE_ID) {
      unavailable.push({ ...patient, reason: row.ENCOUNTER_ID ? 'Readiness not available' : 'No day-care visit recorded' });
      continue;
    }
    if (!OUTCOMES.has(row.OUTCOME) || !row.KNOWN_AS_OF || !row.ENCOUNTER_ID || !row.SCHEDULED) {
      throw new Error('queue_readiness_invalid');
    }
    const key = `${row.PATIENT_ID}:${row.ENCOUNTER_ID}:${row.GATE}:${row.RULE_ID}`;
    if (seen.has(key)) throw new Error('queue_duplicate_readiness');
    seen.add(key);
    const linkedTasks = tasks.filter(task => task.patientId === row.PATIENT_ID && task.ruleId === row.RULE_ID
      && (!task.encounterId || task.encounterId === row.ENCOUNTER_ID));
    if (row.OUTCOME === 'pass' && !linkedTasks.some(task => !CLOSED_STATES.has(task.state))) continue;
    linkedTasks.forEach(task => attachedTasks.add(task.taskId));
    issues.push({
      key, patientId: row.PATIENT_ID, patientName: patient.name, encounterId: row.ENCOUNTER_ID,
      scheduled: row.SCHEDULED, daysToVisit: row.DAYS_TO_VISIT ?? null,
      gate: row.GATE, ruleId: row.RULE_ID, ruleVersion: row.RULE_VERSION,
      outcome: row.OUTCOME, severity: row.SEVERITY, reason: row.REASON ?? null,
      knownAsOf: row.KNOWN_AS_OF, tasks: linkedTasks,
    });
  }
  // Keep open tasks for other visits visible without inventing a readiness result.
  const otherTasks = tasks.filter(task => !attachedTasks.has(task.taskId) && !CLOSED_STATES.has(task.state));
  return { patients, issues, unavailable, otherTasks };
}

// Owner-only reads keep raw table privileges away from SAARTHI_APP.
export const QUEUE_CALLS = ['patients', 'queue_readiness', 'queue_tasks'].map(view =>
  `CALL SAARTHI.OPERATIONAL.GET_WEB_WORKSPACE('${view}',7)`);
export async function readLiveReviewQueue(run) {
  const results = [];
  for (const sql of QUEUE_CALLS) {
    const rows = await run(sql);
    const cell = Object.values(rows[0] ?? {})[0];
    const result = typeof cell === 'string' ? JSON.parse(cell) : cell;
    if (result?.error || !Array.isArray(result?.rows)) throw new Error(result?.error ?? 'queue_unavailable');
    results.push(result.rows);
  }
  return buildLiveReviewQueue(...results);
}
