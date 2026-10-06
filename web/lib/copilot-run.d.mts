import type { LiveStep, RosterEntry } from "./copilot-intent.mjs";

export type StepState = "pending" | "active" | "done" | "skipped" | "failed";
export type RunStep = { id: string; step: LiveStep; label: string; receipt: string | null;
  state: StepState };
export type RunStatus = "running" | "awaiting" | "paused" | "done" | "failed" | "cancelled";
export type LiveRun = { id: string; request: string; source: "voice" | "chat" | "dock";
  status: RunStatus; steps: RunStep[]; awaiting: { candidates: RosterEntry[] } | null;
  note: string | null; origin: string | null; expectedPatient: string | null;
  startedAt: number; finishedAt: number | null };
export type LiveRunnerSnapshot = { run: LiveRun | null; history: LiveRun[] };
export type StepTools = { signal: AbortSignal; run: LiveRun;
  awaitChoice: (candidates: RosterEntry[]) => Promise<string>;
  expectPatient: (patientId: string | null) => void };
export class StepSkipped extends Error { constructor(receipt: string); }
export type LiveRunner = {
  getSnapshot: () => LiveRunnerSnapshot;
  subscribe: (listener: () => void) => () => void;
  start: (request: string, steps: LiveStep[], meta: { source: LiveRun["source"];
    origin: string | null; expectedPatient: string | null }) => Promise<void>;
  pause: (note?: string) => void;
  resume: () => void;
  cancel: (note?: string) => void;
  choose: (patientId: string) => boolean;
  noteManualInput: () => boolean;
  notePatient: (patientId: string | null) => void;
  clear: () => void;
};
export function createLiveRunner(options: {
  execute: (step: LiveStep, tools: StepTools) => Promise<string>;
  createId?: () => string;
  now?: () => number;
}): LiveRunner;
