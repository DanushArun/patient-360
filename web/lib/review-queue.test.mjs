import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildLiveReviewQueue, readLiveReviewQueue, QUEUE_PATIENTS_SQL, QUEUE_READINESS_SQL, QUEUE_TASKS_SQL, QUEUE_CALLS } from './review-queue.mjs';

const fixture = JSON.parse(readFileSync(new URL('../../frontend/fixtures/daycare_census_recorded.json', import.meta.url)));
const source = fixture.rows.find(row => row.patient_id === 'PAT-DC-07' && row.rule_id === 'COV-AUTH-001');
const patient = { PATIENT_ID: source.patient_id, NAME: source.name };
const readiness = { ...Object.fromEntries(Object.entries(source).map(([key, value]) => [key.toUpperCase(), value])), KNOWN_AS_OF: fixture.recorded_at, DAYS_TO_VISIT: 2 };
const task = { PATIENT_ID: source.patient_id, RULE_ID: source.rule_id, ENCOUNTER_ID: null,
  TASK_ID: 'test-task', ISSUE_ID: `${source.patient_id}:${source.rule_id}`, STATE: 'open',
  OWNER_PRACTITIONER_ID: 'test-owner', OWNER_NAME: null, DECISION: 'request_document', CREATED_AT: fixture.recorded_at };

test('queue preserves exact source identity, rule, reason and timestamp', () => {
  const result = buildLiveReviewQueue([patient], [readiness], []);
  assert.equal(result.issues.length, 1);
  const issue = result.issues[0];
  assert.equal(issue.patientName, source.name);
  assert.equal(issue.patientId, source.patient_id);
  assert.equal(issue.outcome, source.outcome);
  assert.equal(issue.reason, source.reason);
  assert.equal(issue.knownAsOf, fixture.recorded_at);
  assert.deepEqual(issue.tasks, []);
});

test('task owner and workflow state are not clinical outcome or consent', () => {
  const result = buildLiveReviewQueue([patient], [readiness], [task]);
  assert.equal(result.issues[0].outcome, source.outcome);
  assert.equal(result.issues[0].tasks[0].state, 'open');
  assert.equal(result.issues[0].tasks[0].owner, 'test-owner');
  assert.equal(result.issues[0].tasks[0].issueId, task.ISSUE_ID);
});

test('passes stay visible when a task is open, but not when all tasks are closed', () => {
  const pass = { ...readiness, OUTCOME: 'pass' };
  assert.equal(buildLiveReviewQueue([patient], [pass], [task]).issues.length, 1);
  assert.equal(buildLiveReviewQueue([patient], [pass], [{ ...task, STATE: 'closed' }]).issues.length, 0);
});

test('missing readiness and missing owner are never inferred as pass or assigned', () => {
  const result = buildLiveReviewQueue([patient], [{ ...patient, ENCOUNTER_ID: source.encounter_id }], [{ ...task, OWNER_PRACTITIONER_ID: null }]);
  assert.equal(result.issues.length, 0);
  assert.equal(result.unavailable.length, 1);
  assert.equal(result.otherTasks[0].owner, null);
});

test('another encounter task stays separate from selected-visit clinical results', () => {
  const result = buildLiveReviewQueue([patient], [readiness], [{ ...task, ENCOUNTER_ID: 'another-encounter' }]);
  assert.equal(result.issues[0].tasks.length, 0);
  assert.equal(result.otherTasks.length, 1);
});

test('foreign identities, unknown outcomes and missing timestamps fail closed', () => {
  assert.throws(() => buildLiveReviewQueue([], [readiness], []), /scope_mismatch/);
  assert.throws(() => buildLiveReviewQueue([patient], [readiness], [{ ...task, PATIENT_ID: 'foreign-id' }]), /scope_mismatch/);
  assert.throws(() => buildLiveReviewQueue([patient], [{ ...readiness, OUTCOME: null }], []), /readiness_invalid/);
  assert.throws(() => buildLiveReviewQueue([patient], [{ ...readiness, KNOWN_AS_OF: null }], []), /readiness_invalid/);
  assert.throws(() => buildLiveReviewQueue([patient], [readiness, readiness], []), /duplicate_readiness/);
});

test('every query checks actor, care-team dates, role, consent dates/purpose and recipient', () => {
  for (const sql of [QUEUE_PATIENTS_SQL, QUEUE_READINESS_SQL, QUEUE_TASKS_SQL]) {
    for (const clause of ['CURRENT_USER()', 'pr.active = TRUE', 'ct.active_from <= CURRENT_DATE()', 'ct.active_to >= CURRENT_DATE()', "ct.role_type IN ('treating', 'coordinator')", 'c.valid_from <= CURRENT_TIMESTAMP()', 'c.valid_until >= CURRENT_TIMESTAMP()', "c.purpose_code IN ('treatment', 'coordination')", 'c.granted_to_facility_id = pr.facility_id', 'c.granted_to_org_id = f.org_id']) {
      assert.ok(sql.includes(clause), clause);
    }
    assert.doesNotMatch(sql, /CURRENT_ROLE\(|AI_COMPLETE|CALL .*REFRESH|DT_REVIEW_QUEUE/);
  }
  assert.match(QUEUE_READINESS_SQL, /rs.patient_id = p.patient_id AND rs.encounter_id = e.encounter_id/);
  assert.match(QUEUE_TASKS_SQL, /rt.issue_id = r.patient_id \|\| ':' \|\| r.rule_id/);
});

test('three bounded reads, and a task-read failure is not shown as no tasks', async () => {
  const calls = [];
  const result = await readLiveReviewQueue(async sql => {
    calls.push(sql);
    return [{ RESULT: { rows: sql === QUEUE_CALLS[0] ? [patient] : sql === QUEUE_CALLS[1] ? [readiness] : [task] } }];
  });
  assert.equal(calls.length, 3);
  assert.equal(result.issues[0].tasks.length, 1);
  await assert.rejects(readLiveReviewQueue(async sql => {
    if (sql === QUEUE_CALLS[2]) throw new Error('task-read-failed');
    return [{ RESULT: { rows: sql === QUEUE_CALLS[0] ? [patient] : [readiness] } }];
  }), /task-read-failed/);
});

test('live queue does not import fixtures or link to design-preview', () => {
  const page = readFileSync(new URL('../app/review-queue/page.tsx', import.meta.url), 'utf8');
  const client = readFileSync(new URL('../app/review-queue/review-queue-client.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page + client, /fixtures\/|design-preview\/|read-only preview|Recorded fixture preview/);
  assert.match(page, /withReadSession\(readLiveReviewQueue\)/);
  assert.match(client, /href=\{`\/patient\//);
  assert.match(client, /patients=\{queue.patients\} \/>/);
});
