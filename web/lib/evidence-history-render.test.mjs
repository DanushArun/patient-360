import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const source = readFileSync(
  new URL("../components/evidence-history.tsx", import.meta.url), "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

function loadPreparePacket() {
  const module = { exports: {} };
  const mockedRequire = (name) => name === "@/lib/workspace-state.mjs"
    ? { announcePatientAccessWithdrawn() {}, purgesPatientState() { return false; } }
    : require(name);
  new Function("require", "module", "exports", compiled)(
    mockedRequire, module, module.exports,
  );
  return module.exports.PreparePacket;
}

test("test_packet_preparation_when_class_a_is_rendered_names_the_practitioner", () => {
  const PreparePacket = loadPreparePacket();
  const markup = renderToStaticMarkup(React.createElement(PreparePacket, {
    patientId: "PAT-1", question: "Should the patient proceed?",
    practitionerName: "Dr Meera Iyer",
  }));

  assert.match(markup, /For treating practitioner: Dr Meera Iyer/);
  assert.match(markup, /Prepare evidence packet for Dr Meera Iyer/);
  assert.doesNotMatch(markup, /sent/i);
});

test("test_packet_request_when_patient_or_question_changes_gets_new_component_key", () => {
  const PreparePacket = loadPreparePacket();
  const props = { patientId: "PAT-1", question: "Should the patient proceed?",
    practitionerName: "Dr Meera Iyer" };

  assert.notEqual(PreparePacket(props).key,
    PreparePacket({ ...props, patientId: "PAT-2" }).key);
  assert.notEqual(PreparePacket(props).key,
    PreparePacket({ ...props, question: "Is this safe?" }).key);
});
