import assert from "node:assert/strict";
import test from "node:test";
import { formatClock, humanizeClocks } from "./display-format.mjs";

test("clock reads naturally without seconds or zone noise", () => {
  assert.equal(formatClock("2026-09-23T14:14:48"), "23 Sept 2026, 14:14");
  assert.equal(formatClock("2026-10-05 09:58:33.093Z"), "5 Oct 2026, 09:58 UTC");
  assert.equal(formatClock("2026-10-03"), "3 Oct 2026");
  assert.equal(formatClock(null), "Not recorded");
  assert.equal(formatClock("soon"), "Not recorded");
});

test("ISO stamps inside record text become readable clocks", () => {
  assert.equal(humanizeClocks("no usable ANC evidence found as of 2026-10-05T07:04:07"),
    "no usable ANC evidence found as of 5 Oct 2026, 07:04");
  assert.equal(humanizeClocks("PLT is 82000, below threshold 100000"),
    "PLT is 82000, below threshold 100000");
  assert.equal(humanizeClocks(null), "");
});
