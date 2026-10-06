import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { documentLibraryRows } from "./workspace-documents.mjs";

// Regression (6 Oct, demo preflight): clicking a document stored its bare doc_id while the
// lookup compared row ids ("document:<doc_id>"), so every click fell back to the first
// document and "Open source" opened the wrong report.
test("selecting a document stores the same id the selection lookup compares", () => {
  const [row] = documentLibraryRows([{ doc_id: "DOC-ECHO-DC-12", doc_type: "imaging_report" }], []);
  assert.equal(row.id, "document:DOC-ECHO-DC-12");
  const source = readFileSync(new URL("../components/workspace-patient-data.tsx", import.meta.url), "utf8");
  assert.match(source, /setSelection\(\{ patientId, docId: row\.id \}\)/);
  assert.match(source, /row\.id === selectedId/);
});
