import test from "node:test";
import assert from "node:assert/strict";
import { confirmWriteReceipt } from "./write-receipts.mjs";

test("test_receipt_confirms_persistence_when_readback_matches", async () => {
  const result = await confirmWriteReceipt({
    receipt: { task_id: "task-1", version: 2 },
    idKey: "task_id",
    readBack: async () => [{ TASK_ID: "task-1", ISSUE_VERSION: 2 }],
    matches: (row) => row.TASK_ID === "task-1" && row.ISSUE_VERSION === 2,
  });
  assert.equal(result.read_back_confirmed, true);
});

test("test_receipt_rejects_empty_readback", async () => {
  await assert.rejects(confirmWriteReceipt({
    receipt: { task_id: "task-1" }, idKey: "task_id",
    readBack: async () => [], matches: () => true,
  }), { message: "write_readback_unconfirmed" });
});

test("test_receipt_rejects_readback_with_changed_version", async () => {
  await assert.rejects(confirmWriteReceipt({
    receipt: { task_id: "task-1", version: 2 }, idKey: "task_id",
    readBack: async () => [{ TASK_ID: "task-1", ISSUE_VERSION: 3 }],
    matches: (row) => row.ISSUE_VERSION === 2,
  }), { message: "write_readback_unconfirmed" });
});

test("test_receipt_rejects_missing_write_identifier", async () => {
  await assert.rejects(confirmWriteReceipt({
    receipt: {}, idKey: "task_id", readBack: async () => [], matches: () => true,
  }), { message: "write_receipt_missing" });
});

test("test_receipt_reports_uncertain_save_when_readback_fails", async () => {
  await assert.rejects(confirmWriteReceipt({
    receipt: { packet_id: "packet-1" }, idKey: "packet_id",
    readBack: async () => { throw new Error("internal service details"); },
    matches: () => true,
  }), { message: "write_readback_unavailable" });
});

test("test_receipt_preserves_access_error_when_readback_is_revoked", async () => {
  await assert.rejects(confirmWriteReceipt({
    receipt: { task_id: "task-1" }, idKey: "task_id",
    readBack: async () => { throw new Error("access_withdrawn"); },
    matches: () => true,
  }), { message: "access_withdrawn" });
});
