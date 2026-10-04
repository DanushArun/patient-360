import assert from "node:assert/strict";
import test from "node:test";
import { evidenceSpan } from "./evidence-span.mjs";

test("exact source excerpts survive non-BMP and Indic text", () => {
  const text = "📄 रिपोर्ट\nHER2 IHC: 2+\n";
  const start = Array.from("📄 रिपोर्ट\n").length;
  const result = evidenceSpan(text, start, start + Array.from("HER2 IHC: 2+").length);
  assert.equal(result.highlight, "HER2 IHC: 2+");
  assert.equal(result.before + result.highlight + result.after, text);
});
test("repeated excerpts respect explicit positions", () => {
  const result = evidenceSpan("II / II", "5", "7");
  assert.equal(result.before, "II / ");
  assert.equal(result.highlight, "II");
});
test("missing and whole-page evidence are not called precise excerpts", () => {
  assert.equal(evidenceSpan("report").reason, "no_span");
  assert.equal(evidenceSpan("report", 0, 6).reason, "whole_page");
});
for (const [start, end] of [["", "3"], [" ", "3"], ["1e0", "3"], ["0x1", "3"],
  ["-1", "3"], ["1.5", "3"], [0, 99], [3, 3], [4, 3], [null, 3],
  [true, 3], [0, Infinity], ["9007199254740992", "9007199254740993"]]) {
  test(`reject malformed span ${String(start)} to ${String(end)}`, () => {
    const result = evidenceSpan("report", start, end);
    assert.equal(result.kind, "page");
    assert.equal(result.reason, "invalid_span");
    assert.equal(result.before, "report");
  });
}
