export type RecordedReviewIssue = {
  issue_id: string;
  patient_id: string;
  patient_name: string;
  gate: string;
  rule_id: string;
  rule_version: number;
  outcome: 'fail' | 'not_evaluated' | 'conflicting';
  severity: 'blocker' | 'advisory';
  reason: string;
  scheduled: string;
  days_to_visit: number;
  state: null;
  owner_practitioner_name: null;
};

export function buildReviewQueuePreview(recorded: {
  recorded_at: string;
  rows: {
    patient_id: string; name: string; encounter_id: string; gate: string;
    rule_id: string; rule_version: number; outcome: string; severity: string;
    reason: string; scheduled: string;
  }[];
}): {
  recordedAt: string;
  patients: { id: string; name: string }[];
  issues: RecordedReviewIssue[];
};
