export type CohortStatus = "blocked" | "conflict" | "waiting" | "advisory" | "ready";
export type CohortRow = { patientId: string; name: string; status: CohortStatus;
  headline: string | null; headlineRule: string | null; otherIssues: number };
export type CohortTurn = { id: string; role: "user"; text: string } | {
  id: string; role: "assistant"; title: string | null; rows: CohortRow[];
  counts?: Record<CohortStatus, number>; basis: string | null;
  known_as_of: string | null; text?: string; error?: string | null;
};
export type CohortSessionSnapshot = { turns: CohortTurn[]; busy: boolean; question: string };
export type CohortSession = {
  getSnapshot: () => CohortSessionSnapshot;
  subscribe: (listener: () => void) => () => void;
  setQuestion: (question: string) => void;
  send: (question: string) => Promise<void>;
  stop: () => void;
};
export function createCohortSession(options?: {
  request?: (question: string, signal: AbortSignal) => Promise<Partial<CohortTurn>>;
  createId?: () => string;
}): CohortSession;
