import assert from "node:assert/strict";
import test from "node:test";
import { createCohortSession } from "./copilot-session.mjs";

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test("worklist conversation survives leaving and returning to its view while a read is running", async () => {
  const pending = deferred();
  const session = createCohortSession({ request: () => pending.promise, createId: (() => {
    let id = 0;
    return () => `turn-${++id}`;
  })() });
  const unsubscribe = session.subscribe(() => {});

  const sending = session.send("List the blocked patients");
  assert.equal(session.getSnapshot().busy, true);
  assert.equal(session.getSnapshot().turns[0].text, "List the blocked patients");
  unsubscribe(); // the route-specific view unmounts
  pending.resolve({ title: "Blocked", rows: [], counts: {}, known_as_of: "2026-10-06T06:00:00" });
  await sending;

  const restored = session.getSnapshot(); // the view subscribes again after navigation
  assert.equal(restored.turns.length, 2);
  assert.equal(restored.turns[1].title, "Blocked");
  assert.equal(restored.busy, false);
});

test("stopping an in-flight worklist read keeps an honest stopped result", async () => {
  let observedSignal;
  const session = createCohortSession({
    request: (_question, signal) => new Promise((_resolve, reject) => {
      observedSignal = signal;
      signal.addEventListener("abort", () => reject(new DOMException("Stopped", "AbortError")));
    }),
  });

  const sending = session.send("List the blocked patients");
  session.stop();
  await sending;

  assert.equal(observedSignal.aborted, true);
  assert.equal(session.getSnapshot().turns.at(-1).error, "cancelled");
  assert.equal(session.getSnapshot().busy, false);
});
