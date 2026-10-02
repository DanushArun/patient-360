import assert from "node:assert/strict";
import test from "node:test";
import {
  confirmTaskRequest,
  patientTaskStorageKey,
  restoreOrCreateTaskRequest,
} from "./patient-task-idempotency.mjs";

test("task retries reuse an uncertain id and confirmed writes start a new id", () => {
  const attempts = new Map();
  const storage = createTaskStorage();
  let next = 0;
  const createId = () => `request-${++next}`;
  const key = patientTaskStorageKey("PAT-1", "RULE-1", "escalate");
  const first = restoreOrCreateTaskRequest(attempts, key, createId, () => storage).requestId;
  const retry = restoreOrCreateTaskRequest(attempts, key, createId, () => storage).requestId;
  assert.equal(first, retry);
  confirmTaskRequest(attempts, key, () => storage);
  assert.notEqual(restoreOrCreateTaskRequest(attempts, key, createId, () => storage).requestId,
    first);
});

test("document SQL keys normalize without dropping explicit nulls", async () => {
  const { normalizeWorkspaceRows } = await import("./workspace-data.mjs");
  assert.deepEqual(normalizeWorkspaceRows([{ PAGE_INDEX: 2, TEXT: "Source", EVENT_TIME: null }]), [
    { page_index: 2, text: "Source", event_time: null },
  ]);
});

test("facts copy distinguishes query-time reads from lab ingestion cutoffs", async () => {
  const { factsTemporalDescription } = await import("./workspace-data.mjs");
  assert.equal(factsTemporalDescription({ as_of_semantics: "current_at_query",
    known_as_of: "2026-10-02T08:00:00", requested_known_as_of: "2026-10-01" }),
  "Current facts read at 2026-10-02T08:00:00; the requested historical cutoff does not apply.");
  assert.equal(factsTemporalDescription({ as_of_semantics: "ingested_cutoff",
    known_as_of: "2026-10-02T08:00:00" }), "Lab data ingested through 2026-10-02T08:00:00.");
});

test("task receipt requires read-back confirmation, task id, and a recognized state", async () => {
  const { confirmedTaskReceipt } = await import("./patient-task-idempotency.mjs");
  assert.deepEqual(confirmedTaskReceipt({ task_id: "TASK-1", state: "closed",
    idempotent_replay: true, read_back_confirmed: true }), {
    taskId: "TASK-1", state: "closed", replay: true,
  });
  assert.equal(confirmedTaskReceipt({ task_id: "TASK-1", state: "open" }), null);
  assert.equal(confirmedTaskReceipt({ task_id: "TASK-1", state: "unknown",
    read_back_confirmed: true }), null);
  assert.equal(confirmedTaskReceipt({ state: "open", read_back_confirmed: true }), null);
  assert.equal(confirmedTaskReceipt({ task_id: "   ", state: "open",
    read_back_confirmed: true }), null);
});

test("task request reload when saved then restores the same request id", async () => {
  const { restoreOrCreateTaskRequest, patientTaskStorageKey } = await import(
    "./patient-task-idempotency.mjs");
  const storage = createTaskStorage();
  const key = patientTaskStorageKey("PAT-1", "RULE-1", "escalate");
  const first = restoreOrCreateTaskRequest(new Map(), key, () => "request-1", () => storage);
  const reloaded = restoreOrCreateTaskRequest(new Map(), key, () => "request-2", () => storage);
  assert.deepEqual(first, { requestId: "request-1", persistenceAvailable: true });
  assert.deepEqual(reloaded, first);
});

test("task request confirmation when persisted then clears before the next action", async () => {
  const { restoreOrCreateTaskRequest, confirmTaskRequest, patientTaskStorageKey } = await import(
    "./patient-task-idempotency.mjs");
  const storage = createTaskStorage();
  const attempts = new Map();
  const key = patientTaskStorageKey("PAT-1", "RULE-1", "request_document");
  const first = restoreOrCreateTaskRequest(attempts, key, () => "request-1", () => storage);
  assert.equal(confirmTaskRequest(attempts, key, () => storage), true);
  const next = restoreOrCreateTaskRequest(attempts, key, () => "request-2", () => storage);
  assert.notEqual(next.requestId, first.requestId);
});

test("task request purge when patient access is withdrawn then removes all of that patient’s ids",
  async () => {
    const { restoreOrCreateTaskRequest, purgePatientTaskRequests, patientTaskStorageKey } =
      await import("./patient-task-idempotency.mjs");
    const storage = createTaskStorage();
    const attempts = new Map();
    const firstKey = patientTaskStorageKey("PAT-1", "RULE-1", "escalate");
    const secondKey = patientTaskStorageKey("PAT-1", "RULE-2", "request_document");
    const otherKey = patientTaskStorageKey("PAT-2", "RULE-1", "escalate");
    for (const key of [firstKey, secondKey, otherKey]) {
      restoreOrCreateTaskRequest(attempts, key, () => key, () => storage);
    }
    assert.equal(purgePatientTaskRequests(attempts, "PAT-1", () => storage), true);
    assert.equal(attempts.has(firstKey), false);
    assert.equal(attempts.has(secondKey), false);
    assert.equal(storage.getItem(firstKey), null);
    assert.equal(storage.getItem(secondKey), null);
    assert.equal(storage.getItem(otherKey), otherKey);
  });

test("task request storage denied when saving then reuses memory id and reports no persistence",
  async () => {
  const { restoreOrCreateTaskRequest, patientTaskStorageKey } = await import(
    "./patient-task-idempotency.mjs");
  const attempts = new Map();
  const key = patientTaskStorageKey("PAT-1", "RULE-1", "escalate");
  const getStorage = () => { throw new Error("storage denied"); };
  const first = restoreOrCreateTaskRequest(attempts, key, () => "request-1", getStorage);
  const retry = restoreOrCreateTaskRequest(attempts, key, () => "request-2", getStorage);
  assert.deepEqual(first, { requestId: "request-1", persistenceAvailable: false });
  assert.deepEqual(retry, first);
});

function createTaskStorage() {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => { entries.set(key, value); },
    removeItem: (key) => { entries.delete(key); },
    key: (index) => [...entries.keys()][index] ?? null,
    get length() { return entries.size; },
  };
}
