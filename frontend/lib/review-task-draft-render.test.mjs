import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../components/review-task-draft.tsx", import.meta.url),
  "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

function loadDraft() {
  const module = { exports: {} };
  const mockedRequire = (name) => name.endsWith(".module.css")
    ? { __esModule: true, default: { actions: "actions" } } : require(name);
  new Function("require", "module", "exports", compiled)(mockedRequire, module, module.exports);
  return module.exports.ReviewTaskDraft;
}

const gate = { gate: "Authorization", rule_id: "COV-AUTH-001", rule_version: 1,
  outcome: "conflicting", reason: "Authorization dates disagree.",
  evidence_ids: ["AUTH-STRUCTURED-1", "DOC-LETTER-1"] };

test("test_review_task_draft_when_patient_and_recipient_are_verified_names_them", () => {
  const Draft = loadDraft();
  const markup = renderToStaticMarkup(React.createElement(Draft, {
    patientId: "PAT-DC-04", patientName: "Fatima Begum", recipientName: "Dr Example",
    gate, action: "request_document", pending: false, onCancel: () => {}, onCreate: () => {},
  }));

  assert.match(markup, /Fatima Begum/);
  assert.match(markup, /Dr Example/);
  assert.match(markup, /AUTH-STRUCTURED-1, DOC-LETTER-1/);
  assert.match(markup, /Authorization dates disagree\./);
  assert.match(markup, /Draft · Not created/);
  assert.doesNotMatch(markup, /Task ID|Created at|2026-10-03/);
  assert.doesNotMatch(markup, /undefined|\bnull\b/);
});

test("test_review_task_draft_when_recipient_is_unknown_does_not_claim_an_assignee", () => {
  const Draft = loadDraft();
  const markup = renderToStaticMarkup(React.createElement(Draft, {
    patientId: "PAT-DC-04", patientName: "Fatima Begum", gate,
    action: "request_document", pending: false, onCancel: () => {}, onCreate: () => {},
  }));

  assert.match(markup, /Recipient verified when saving/);
  assert.doesNotMatch(markup, /Active treating practitioner for this patient/);
});
