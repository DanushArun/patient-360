// Live copilot runner: carries out a plan from copilot-intent.mjs one step at a time and
// publishes what actually happened. A receipt is written only when a step completes, so the
// activity list never claims work that did not occur (HIG Generative AI: describe real
// progress). Pause stops dispatching further steps; the step already running may finish.
// Stop aborts the running step and discards anything it returns late.

import { stepLabel, stepMovesView } from "./copilot-intent.mjs";

/** @typedef {import("./copilot-intent.mjs").LiveStep} LiveStep */
/** @typedef {"pending" | "active" | "done" | "skipped" | "failed"} StepState */
/** @typedef {{ id: string, step: LiveStep, label: string, receipt: string | null,
 *   state: StepState }} RunStep */
/** @typedef {"running" | "awaiting" | "paused" | "done" | "failed" | "cancelled"} RunStatus */
/** @typedef {{ id: string, request: string, source: "voice" | "chat" | "dock",
 *   status: RunStatus, steps: RunStep[], awaiting: { candidates: { id: string, name: string }[] }
 *   | null, note: string | null, origin: string | null, expectedPatient: string | null,
 *   startedAt: number, finishedAt: number | null }} LiveRun */

const FINISHED = new Set(["done", "failed", "cancelled"]);

export class StepSkipped extends Error {
  constructor(receipt) { super(receipt); this.name = "StepSkipped"; }
}

/**
 * @param {{
 *   execute: (step: LiveStep, tools: { signal: AbortSignal, run: LiveRun,
 *     awaitChoice: (candidates: { id: string, name: string }[]) => Promise<string>,
 *     expectPatient: (patientId: string | null) => void }) => Promise<string>,
 *   createId?: () => string,
 *   now?: () => number,
 * }} options
 */
export function createLiveRunner({ execute, createId = () => crypto.randomUUID(),
  now = () => Date.now() }) {
  /** @type {{ run: LiveRun | null, history: LiveRun[] }} */
  let snapshot = { run: null, history: [] };
  const listeners = new Set();
  let controller = null;
  let resumeWaiter = null;
  let choiceWaiter = null;

  const publish = (patch) => {
    if (!snapshot.run) return;
    const run = { ...snapshot.run, ...patch };
    const history = FINISHED.has(run.status)
      ? [run, ...snapshot.history.filter((item) => item.id !== run.id)].slice(0, 10)
      : snapshot.history;
    snapshot = { run, history };
    for (const listener of listeners) listener();
  };
  const patchStep = (index, patch) => {
    const steps = snapshot.run.steps.map((item, at) => at === index ? { ...item, ...patch } : item);
    publish({ steps });
  };
  const finish = (status, note = null) => {
    if (!snapshot.run || FINISHED.has(snapshot.run.status)) return;
    const steps = snapshot.run.steps.map((item) => item.state === "pending" || item.state === "active"
      ? { ...item, state: "skipped" } : item);
    publish({ status, note, steps, awaiting: null, finishedAt: now() });
    resumeWaiter?.();
    choiceWaiter?.reject(new DOMException("Run ended", "AbortError"));
    resumeWaiter = null;
    choiceWaiter = null;
  };

  async function drive(runId, signal) {
    for (let index = 0; index < snapshot.run.steps.length; index += 1) {
      if (signal.aborted || snapshot.run.id !== runId) return;
      while (snapshot.run.status === "paused") {
        await new Promise((resolve) => { resumeWaiter = resolve; });
        if (signal.aborted || snapshot.run.id !== runId) return;
      }
      patchStep(index, { state: "active" });
      try {
        const receipt = await execute(snapshot.run.steps[index].step, {
          signal,
          run: snapshot.run,
          awaitChoice: (candidates) => new Promise((resolve, reject) => {
            choiceWaiter = { resolve, reject };
            publish({ status: "awaiting", awaiting: { candidates } });
          }),
          expectPatient: (patientId) => publish({ expectedPatient: patientId }),
        });
        if (signal.aborted || snapshot.run.id !== runId) return;
        if (snapshot.run.status === "awaiting") publish({ status: "running", awaiting: null });
        patchStep(index, { state: "done", receipt });
      } catch (error) {
        if (signal.aborted || snapshot.run.id !== runId) return;
        if (error instanceof StepSkipped) {
          patchStep(index, { state: "skipped", receipt: error.message });
          continue;
        }
        patchStep(index, { state: "failed",
          receipt: error instanceof Error ? error.message : "The step could not be completed." });
        finish("failed", error instanceof Error ? error.message : null);
        return;
      }
    }
    if (snapshot.run.id === runId) finish("done");
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    /**
     * @param {string} request
     * @param {LiveStep[]} steps
     * @param {{ source: LiveRun["source"], origin: string | null,
     *   expectedPatient: string | null }} meta
     */
    start(request, steps, meta) {
      this.cancel("Replaced by a new request.");
      controller = new AbortController();
      const run = /** @type {LiveRun} */ ({
        id: createId(), request, source: meta.source, status: "running",
        steps: steps.map((step) => ({ id: createId(), step, label: stepLabel(step),
          receipt: null, state: "pending" })),
        awaiting: null, note: null, origin: meta.origin, expectedPatient: meta.expectedPatient,
        startedAt: now(), finishedAt: null,
      });
      snapshot = { ...snapshot, run };
      for (const listener of listeners) listener();
      const done = drive(run.id, controller.signal);
      return done;
    },
    pause(note = "Paused. Resume when you're ready.") {
      if (snapshot.run?.status === "running") publish({ status: "paused", note });
    },
    resume() {
      if (snapshot.run?.status !== "paused") return;
      publish({ status: "running", note: null });
      resumeWaiter?.();
      resumeWaiter = null;
    },
    cancel(note = "Stopped. Nothing further was opened or asked.") {
      if (!snapshot.run || FINISHED.has(snapshot.run.status)) return;
      controller?.abort();
      controller = null;
      finish("cancelled", note);
    },
    /** A person chose a patient: from the dock, or by opening their record themselves. */
    choose(patientId) {
      const options = snapshot.run?.awaiting?.candidates ?? [];
      if (!choiceWaiter || !options.some((item) => item.id === patientId)) return false;
      const waiter = choiceWaiter;
      choiceWaiter = null;
      publish({ status: "running", awaiting: null, expectedPatient: patientId });
      waiter.resolve(patientId);
      return true;
    },
    /** Manual work on the page pauses steps that would move the view, never a running read. */
    noteManualInput() {
      const run = snapshot.run;
      if (run?.status !== "running") return false;
      const moves = run.steps.some((item) => (item.state === "pending" || item.state === "active")
        && stepMovesView(item.step));
      if (moves) this.pause("Paused because you took over. Resume when you're ready.");
      return moves;
    },
    /** The record on screen changed. If it is not the one this run is working on, stop. */
    notePatient(patientId) {
      const run = snapshot.run;
      if (!run || FINISHED.has(run.status)) return;
      // Leaving a record passes through "no patient"; only a different record matters.
      if (!patientId || patientId === run.expectedPatient) return;
      if (run.status === "awaiting"
        && run.awaiting?.candidates.some((item) => item.id === patientId)) {
        this.choose(patientId);
        return;
      }
      this.cancel("Stopped because a different patient was opened.");
    },
    clear() {
      this.cancel();
      snapshot = { ...snapshot, run: null };
      for (const listener of listeners) listener();
    },
  };
}
