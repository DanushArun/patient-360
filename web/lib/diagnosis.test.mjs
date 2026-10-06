import assert from "node:assert/strict";
import test from "node:test";
import { diagnosisLabel } from "./diagnosis.mjs";

test("diagnosis reads as the recorded condition with its ICD-10 code", () => {
  assert.equal(diagnosisLabel("Carcinoma breast", "C50.9"), "Carcinoma breast · C50.9");
  assert.equal(diagnosisLabel("  Carcinoma lung ", null), "Carcinoma lung");
  assert.equal(diagnosisLabel(null, "C50.9"), null, "a code alone is not shown as a diagnosis");
  assert.equal(diagnosisLabel("", "C50.9"), null);
});
