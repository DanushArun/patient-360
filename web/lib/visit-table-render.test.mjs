import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");
const visitModule = loadVisitTable();

const chairs = [{
  encounterId: "VISIT-1", patientId: "PAT-DC-04", name: "Fatima Begum",
  place: "Pune", language: "Hindi", regimen: "Carboplatin + Paclitaxel", cycle: 3,
  scheduled: "2026-10-03T09:00:00", status: "blocked", headlineRule: "CLIN-PLT-001",
  headline: "Platelet check below rule threshold", otherIssues: 2,
}];

test("rendered Visits table aligns visit details and preserves patient link navigation", () => {
  const markup = renderToStaticMarkup(React.createElement(visitModule.VisitTable, { chairs }));

  assert.match(markup, /<table/);
  assert.match(markup, /aria-label="Visit list"/);
  assert.match(markup, /Patient/);
  assert.match(markup, /Date and time/);
  assert.match(markup, /Regimen and cycle/);
  assert.match(markup, /Record check/);
  assert.match(markup, /Main issue/);
  assert.match(markup, /href="\/patient\/PAT-DC-04"/);
  assert.match(markup, /Fatima Begum/);
  assert.match(markup, /Carboplatin \+ Paclitaxel/);
  assert.match(markup, /Cycle 3/);
  assert.match(markup, /Platelet check below rule threshold/);
  assert.match(markup, /timezone not stored/);
});

test("rendered Visits table exposes keyboard-operable sort buttons", () => {
  const markup = renderToStaticMarkup(React.createElement(visitModule.VisitTable, { chairs }));

  assert.match(markup, /<button[^>]*>Patient/);
  assert.match(markup, /<button[^>]*>Date and time/);
  assert.match(markup, /aria-sort="ascending"/);
});

function loadVisitTable() {
  const path = fileURLToPath(new URL("../app/visit-table.tsx", import.meta.url));
  const source = readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { exports: module.exports, module, require: componentDependency });
  return module.exports;
}

function componentDependency(name) {
  if (name === "next/link") {
    return { __esModule: true, default: ({ href, children, prefetch, ...props }) =>
      React.createElement("a", { href, ...props }, children) };
  }
  if (name === "@/components/sa") {
    return { CensusChip: ({ status }) => React.createElement("span", null, status) };
  }
  if (name === "@/lib/census") return {};
  if (name === "@/lib/worklist-display.mjs") return require("./worklist-display.mjs");
  if (name.endsWith(".module.css")) {
    return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
  }
  return require(name);
}
