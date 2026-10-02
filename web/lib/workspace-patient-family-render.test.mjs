import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const componentPath = fileURLToPath(new URL(
  "../components/workspace-patient-family.tsx", import.meta.url));
const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const familyRecord = require("./family-record.mjs");
const navigatorData = require("./navigator-data.json");

test("family checklist renders every returned check with its source label and exact visit date", () => {
  const markup = renderFamily("en");

  assert.match(markup, /Before your visit on 3 Oct 2026 — Fatima Begum/);
  assert.match(markup, /<time dateTime="2026-10-03" title="2026-10-03">3 Oct 2026<\/time>/);
  assert.match(markup, /Returned readiness checks/);
  assert.match(markup, /Platelet check · Fail/);
  assert.match(markup, /Final pathology · Not evaluated/);
  assert.match(markup, /Authorization · Conflicting/);
  assert.match(markup, /CLIN-PLT-001 v1/);
  assert.match(markup, /DOC-PATH-001 v1/);
  assert.match(markup, /COV-AUTH-001 v1/);
  assert.match(markup, /Final pathology report not received/);
  assert.match(markup, /Authorization dates disagree/);
  assert.match(markup, /Only the visit heading is translated/);
  assert.match(markup, /Copy message/);
  assert.match(markup, /aria-live="polite"/);
});

test("family checklist translates only its heading and keeps message reasons unchanged", () => {
  const markup = renderFamily("hi");

  assert.match(markup, /3 Oct 2026 की विज़िट से पहले — Fatima Begum/);
  assert.match(markup, /Source reason \(original language\)/);
  assert.match(markup, /Platelet check · Fail/);
  assert.doesNotMatch(markup, /प्लेटलेट|अंतिम पैथोलॉजी/);
});

test("family checklist rejects malformed visit dates without inventing a date", () => {
  const markup = renderFamily("en", "2026-02-30");

  assert.match(markup, /Upcoming visit date unavailable/);
  assert.doesNotMatch(markup, /Before your visit/);
});

function renderFamily(language, nextVisit = "2026-10-03") {
  const component = loadComponent();
  return renderToStaticMarkup(React.createElement(component.FamilyChecklist, {
    patient: {
      patientId: "PAT-DC-04", patientName: "Fatima Begum", nextVisit,
      scheduledAt: "2026-10-03T09:00:00", gates: familyGates(),
    },
    gates: familyGates(), language, setLanguage: () => {},
  }));
}

function familyGates() {
  return [
    { gate: "Platelet check", outcome: "fail", rule_id: "CLIN-PLT-001",
      rule_version: 1, reason: "Platelet check below rule threshold" },
    { gate: "Final pathology", outcome: "not_evaluated", rule_id: "DOC-PATH-001",
      rule_version: 1, reason: "Final pathology report not received" },
    { gate: "Authorization", outcome: "conflicting", rule_id: "COV-AUTH-001",
      rule_version: 1, reason: "Authorization dates disagree" },
  ];
}

function loadComponent() {
  const source = readFileSync(componentPath, "utf8");
  const ts = require("typescript");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { exports: module.exports, module,
    require: mockedRequire });
  return module.exports;
}

function mockedRequire(name) {
  if (name.endsWith(".module.css")) {
    return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
  }
  if (name === "@/lib/family-record.mjs") return familyRecord;
  if (name === "@/lib/navigator-data.json") {
    return { __esModule: true, default: navigatorData };
  }
  return require(name);
}
