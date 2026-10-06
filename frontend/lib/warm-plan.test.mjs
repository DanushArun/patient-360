import assert from "node:assert/strict";
import test from "node:test";
import { limitConcurrency, workspaceCacheKey } from "./warm-plan.mjs";

test("workspace cache key ignores parameter order and names only validated fields", () => {
  const a = workspaceCacheKey({ view: "documents", domain: null, knownAsOf: "2026-10-05T07:51:53", documentId: null });
  const b = workspaceCacheKey({ documentId: null, knownAsOf: "2026-10-05T07:51:53", domain: null, view: "documents" });
  assert.equal(a, b);
  assert.notEqual(a, workspaceCacheKey({ view: "facts", domain: "labs", knownAsOf: "2026-10-05T07:51:53", documentId: null }));
});

test("concurrency limiter never runs more than the limit at once and keeps every result", async () => {
  let running = 0, peak = 0;
  const run = limitConcurrency(2);
  const task = (value) => run(async () => {
    running += 1; peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 5));
    running -= 1; return value;
  });
  assert.deepEqual(await Promise.all([1, 2, 3, 4, 5].map(task)), [1, 2, 3, 4, 5]);
  assert.equal(peak, 2);
});

test("a failing task releases its slot", async () => {
  const run = limitConcurrency(1);
  await assert.rejects(run(async () => { throw new Error("boom"); }));
  assert.equal(await run(async () => "next"), "next");
});
