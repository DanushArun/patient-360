import assert from "node:assert/strict";
import test from "node:test";
import { createLiveRunner, StepSkipped } from "./copilot-run.mjs";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const ids = () => { let id = 0; return () => `id-${++id}`; };
const meta = { source: "dock", origin: "/", expectedPatient: null };
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("receipts are written only when each step completes", async () => {
  const gates = [deferred(), deferred()];
  let call = 0;
  const runner = createLiveRunner({ createId: ids(), execute: () => gates[call++].promise });
  const done = runner.start("open documents", [{ type: "section", section: "Documents" },
    { type: "ask", scope: "patient", question: "What is missing?" }], meta);
  await tick();
  assert.deepEqual(runner.getSnapshot().run.steps.map((step) => step.state), ["active", "pending"]);
  assert.equal(runner.getSnapshot().run.steps[0].receipt, null);
  gates[0].resolve("Opened Documents");
  await tick();
  assert.equal(runner.getSnapshot().run.steps[0].receipt, "Opened Documents");
  gates[1].resolve("Answered from the record");
  await done;
  assert.equal(runner.getSnapshot().run.status, "done");
  assert.equal(runner.getSnapshot().history.length, 1);
});

test("pause stops dispatching; the running step may finish; resume continues", async () => {
  const first = deferred();
  const seen = [];
  const runner = createLiveRunner({ createId: ids(), execute: (step) => {
    seen.push(step.type);
    return step.type === "section" ? first.promise : Promise.resolve("ok");
  } });
  const done = runner.start("x", [{ type: "section", section: "Facts" },
    { type: "find", kind: "fact", terms: ["plt"], phrase: "plt", open: false }], meta);
  await tick();
  runner.pause();
  first.resolve("Opened Facts");
  await tick();
  assert.deepEqual(seen, ["section"]);
  assert.equal(runner.getSnapshot().run.status, "paused");
  runner.resume();
  await done;
  assert.deepEqual(seen, ["section", "find"]);
  assert.equal(runner.getSnapshot().run.status, "done");
});

test("stop aborts the running step and a late result is discarded", async () => {
  const late = deferred();
  let signal;
  const runner = createLiveRunner({ createId: ids(), execute: (_, tools) => {
    signal = tools.signal;
    return late.promise;
  } });
  const done = runner.start("x", [{ type: "ask", scope: "patient", question: "q" },
    { type: "mark", scope: "patient" }], meta);
  await tick();
  runner.cancel();
  assert.equal(signal.aborted, true);
  late.resolve("Answered");
  await done;
  const run = runner.getSnapshot().run;
  assert.equal(run.status, "cancelled");
  assert.deepEqual(run.steps.map((step) => [step.state, step.receipt]),
    [["skipped", null], ["skipped", null]]);
});

test("patient choice waits for a person; opening a candidate's record counts as choosing", async () => {
  const runner = createLiveRunner({ createId: ids(), execute: async (step, tools) => {
    if (step.type !== "select_patient") return "ok";
    const id = await tools.awaitChoice(step.candidates);
    return `Opened ${id}`;
  } });
  const done = runner.start("open fatima", [{ type: "select_patient",
    candidates: [{ id: "PAT-DC-04", name: "Fatima Begum" }] }], meta);
  await tick();
  assert.equal(runner.getSnapshot().run.status, "awaiting");
  assert.equal(runner.choose("PAT-DC-99"), false, "only an offered candidate can be chosen");
  runner.notePatient("PAT-DC-04");
  await done;
  assert.equal(runner.getSnapshot().run.steps[0].receipt, "Opened PAT-DC-04");
});

test("manual work pauses only while a screen-moving step remains", async () => {
  const ask = deferred();
  const runner = createLiveRunner({ createId: ids(), execute: () => ask.promise });
  const done = runner.start("x", [{ type: "ask", scope: "patient", question: "q" },
    { type: "mark", scope: "patient" }], meta);
  await tick();
  assert.equal(runner.noteManualInput(), false);
  assert.equal(runner.getSnapshot().run.status, "running");
  ask.resolve("ok");
  await done;

  const section = deferred();
  const second = createLiveRunner({ createId: ids(), execute: () => section.promise });
  second.start("y", [{ type: "section", section: "Facts" }], meta);
  await tick();
  assert.equal(second.noteManualInput(), true);
  assert.equal(second.getSnapshot().run.status, "paused");
  second.cancel();
});

test("opening a different patient stops the run; passing through no patient does not", async () => {
  const hold = deferred();
  const runner = createLiveRunner({ createId: ids(), execute: () => hold.promise });
  runner.start("x", [{ type: "ask", scope: "patient", question: "q" }],
    { ...meta, expectedPatient: "PAT-DC-03" });
  await tick();
  runner.notePatient(null);
  assert.equal(runner.getSnapshot().run.status, "running");
  runner.notePatient("PAT-DC-04");
  assert.equal(runner.getSnapshot().run.status, "cancelled");
  assert.match(runner.getSnapshot().run.note, /different patient/);
});

test("a skipped step is reported honestly and the run continues", async () => {
  const runner = createLiveRunner({ createId: ids(), execute: (step) => step.type === "mark"
    ? Promise.reject(new StepSkipped("No cited checks are on this view")) : Promise.resolve("ok") });
  await runner.start("x", [{ type: "mark", scope: "patient" },
    { type: "section", section: "Facts" }], meta);
  const run = runner.getSnapshot().run;
  assert.deepEqual(run.steps.map((step) => step.state), ["skipped", "done"]);
  assert.equal(run.steps[0].receipt, "No cited checks are on this view");
  assert.equal(run.status, "done");
});

test("a failed step ends the run with its reason", async () => {
  const runner = createLiveRunner({ createId: ids(), execute: () =>
    Promise.reject(new Error("No document matching “echo” is on this page.")) });
  await runner.start("x", [{ type: "find", kind: "document", terms: ["echo"], phrase: "echo",
    open: false }, { type: "collect" }], meta);
  const run = runner.getSnapshot().run;
  assert.equal(run.status, "failed");
  assert.deepEqual(run.steps.map((step) => step.state), ["failed", "skipped"]);
});
