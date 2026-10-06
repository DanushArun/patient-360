export type CohortStatus = "blocked" | "conflict" | "waiting" | "advisory" | "ready";
export type CohortIntent = {
  kind: "status" | "topic" | "overview" | "unknown";
  status: CohortStatus | null; rulePrefix: string | null; topic: string | null;
};
export type CohortChair = {
  patientId: string; name: string; status: string; headline: string | null;
  headlineRule: string | null; otherIssues: number; scheduled: string;
};
export function matchCohortIntent(question: string): CohortIntent;
export function answerCohort<T extends CohortChair>(chairs: T[], intent: CohortIntent): {
  title: string | null; rows: T[]; counts: Record<CohortStatus, number>; basis: string | null;
};

export const COHORT_STARTERS: string[];
