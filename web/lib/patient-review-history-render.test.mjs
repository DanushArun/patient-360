import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const componentPath = fileURLToPath(new URL(
  "../app/patient/[id]/patient-review-history.tsx", import.meta.url));

test("task history events render their timestamp and actor distinctly", () => {
  const { TaskRow } = loadComponent();
  const markup = render(TaskRow, { task: {
    taskId: "TASK-1", issueId: "COV-AUTH-001", owner: "Dr Meera Iyer",
    state: "open", action: "created", reason: "Evidence received",
    createdAt: "2026-10-02T10:14:00", ownerId: null, issueVersion: 1,
    isEvent: true, actor: "Dr Meera Iyer",
  } });

  assert.match(markup, /created event/);
  assert.match(markup, /<time dateTime="2026-10-02T10:14:00">2026-10-02T10:14:00<\/time>/);
  assert.match(markup, /Recorded by Dr Meera Iyer/);
  assert.match(markup, /TASK-1/);
});

test("answer history exposes its initial loading state to assistive technology", () => {
  const { EvidenceHistory } = loadEvidenceHistory();
  const markup = render(EvidenceHistory, { patientId: "PAT-DC-04" });

  assert.match(markup, /aria-label="Answer and referral history"/);
  assert.match(markup, /role="status"/);
  assert.match(markup, /Loading saved evidence history/);
});

function render(component, props) {
  const require = createRequire(import.meta.url);
  return require("react-dom/server").renderToStaticMarkup(
    require("react").createElement(component, props));
}

function loadComponent() {
  const require = createRequire(import.meta.url);
  const source = readFileSync(componentPath, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { exports: module.exports, module,
    require: (name) => name === "@/lib/workspace-state.mjs"
      ? { announcePatientAccessWithdrawn() {}, purgesPatientState() { return false; } }
      : require(name),
  });
  return module.exports;
}

function loadEvidenceHistory() {
  const require = createRequire(import.meta.url);
  const path = fileURLToPath(new URL("../components/evidence-history.tsx", import.meta.url));
  const source = readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { exports: module.exports, module,
    require: (name) => name === "@/lib/workspace-state.mjs"
      ? { announcePatientAccessWithdrawn() {}, purgesPatientState() { return false; } }
      : require(name),
  });
  return module.exports;
}
