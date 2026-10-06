export type QueuePatient = { id: string; name: string };
export type QueueTask = {
  taskId: string; issueId: string; patientId: string; ruleId: string; encounterId: string | null;
  ownerId: string | null; owner: string | null; state: string | null; action: string | null;
  reason: string | null; createdAt: string | null;
};
export type QueueIssue = {
  key: string; patientId: string; patientName: string; encounterId: string;
  scheduled: string; daysToVisit: number | null; gate: string; ruleId: string; ruleVersion: number;
  outcome: 'pass' | 'fail' | 'conflicting' | 'not_evaluated'; severity: string | null;
  reason: string | null; knownAsOf: string; tasks: QueueTask[];
};
export type LiveReviewQueue = {
  patients: QueuePatient[]; issues: QueueIssue[];
  unavailable: (QueuePatient & { reason: string })[]; otherTasks: QueueTask[];
};
export const QUEUE_PATIENTS_SQL: string;
export const QUEUE_READINESS_SQL: string;
export const QUEUE_TASKS_SQL: string;
export function buildLiveReviewQueue(patients: Record<string, unknown>[], readiness: Record<string, unknown>[], tasks: Record<string, unknown>[]): LiveReviewQueue;
export function readLiveReviewQueue(run: (sql: string) => Promise<Record<string, unknown>[]>): Promise<LiveReviewQueue>;
