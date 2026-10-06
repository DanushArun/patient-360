import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import * as dateHelpers from "./workspace-record-date.mjs";

const componentPath = fileURLToPath(new URL(
  "../components/workspace-patient-overview.tsx", import.meta.url));
const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");

test("overview shows each returned issue and routes its bounded record action", () => {
  const PatientOverview = loadComponent();
  const markup = renderToStaticMarkup(React.createElement(PatientOverview, {
    patient: patientWithMixedGates(), preview: false, onSelectGate: () => {},
    onCompareSources: () => {}, onSelectDocuments: () => {},
  }));

  assert.match(markup, /<strong>Clinical<\/strong> Fail/);
  assert.match(markup, /<strong>Documents<\/strong> Not evaluated/);
  assert.match(markup, /<strong>Coverage<\/strong> Conflicting/);
  assert.match(markup, /Platelet check below rule threshold/);
  assert.match(markup, /Final pathology report not received/);
  assert.match(markup, /Authorization dates disagree/);
  assert.match(markup, /CLIN-PLT-001 v1/);
  assert.match(markup, /DOC-PATH-001 v1/);
  assert.match(markup, /COV-AUTH-001 v1/);
  assert.match(markup, />View check</);
  assert.match(markup, />Request document</);
  assert.match(markup, />Compare sources</);
  assert.doesNotMatch(markup, />Ready</i);
});

test("overview exposes returned visit and SQL cutoff without inventing source inventory", () => {
  const PatientOverview = loadComponent();
  const markup = renderToStaticMarkup(React.createElement(PatientOverview, {
    patient: patientWithMixedGates(), preview: false, onSelectGate: () => {},
    onSelectDocuments: () => {},
  }));

  assert.match(markup, /3 Oct 2026, 09:00/);
  assert.match(markup, /Carboplatin \+ Paclitaxel/);
  assert.match(markup, /Dr Meera Iyer/);
  assert.match(markup, /1 Oct 2026, 09:42/);
  assert.match(markup, /Recent record/);
  assert.match(markup, /Overview documents/);
  assert.doesNotMatch(markup, /City Labs|HealthSure TPA|Metro Pathology/);
});

test("overview keeps unavailable navigation disabled and explains the missing callback", () => {
  const PatientOverview = loadComponent();
  const markup = renderToStaticMarkup(React.createElement(PatientOverview, {
    patient: patientWithMixedGates(), preview: false, onSelectGate: () => {},
  }));

  assert.match(markup, /disabled/);
  assert.match(markup, /Coverage comparison navigation is unavailable/);
  assert.match(markup, /Recent record/);
});

test("overview disables evidence actions in the recorded preview", () => {
  const PatientOverview = loadComponent();
  const markup = renderToStaticMarkup(React.createElement(PatientOverview, {
    patient: patientWithMixedGates(), preview: true, onSelectGate: () => {},
  }));

  assert.match(markup, /evidence actions are unavailable/);
  assert.match(markup, /Document details are not included in this recorded preview/);
});

function patientWithMixedGates() {
  return {
    patientId: "PAT-DC-04", patientName: "Fatima Begum", consentId: "CONSENT-1",
    practitionerName: "Dr Meera Iyer", treatingPractitionerName: "Dr Meera Iyer",
    language: "en", nextVisit: "2026-10-03", scheduledAt: "2026-10-03T09:00:00",
    cycleNumber: 3, regimen: "Carboplatin + Paclitaxel",
    knownAsOf: "2026-10-01T09:42:00+05:30",
    gates: [
      { gate: "Platelet check", outcome: "fail", rule_id: "CLIN-PLT-001",
        rule_version: 1, reason: "Platelet check below rule threshold",
        evidence_ids: ["EVT-CBC-1"] },
      { gate: "Final pathology", outcome: "not_evaluated", rule_id: "DOC-PATH-001",
        rule_version: 1, reason: "Final pathology report not received", evidence_ids: [] },
      { gate: "Authorization", outcome: "conflicting", rule_id: "COV-AUTH-001",
        rule_version: 1, reason: "Authorization dates disagree",
        evidence_ids: ["AUTH-1", "ASSERT-1"] },
    ],
  };
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
    require: componentDependency });
  return module.exports.PatientOverview;
}

function componentDependency(name) {
  if (name === "./overview-record-inventory") return {
    OverviewRecordInventory: ({ visit, knownAsOf, preview }) => React.createElement("div", null,
      visit, "Recent record · Overview documents · ", dateHelpers.formatRecordDate(knownAsOf),
      preview ? "Document details are not included in this recorded preview" : "Loading inventory"),
  };
  if (name === "@/components/sa") return {
    StatusChip: ({ outcome }) => React.createElement("span", null, outcome),
  };
  if (name === "@/lib/workspace-record-date.mjs") return dateHelpers;
  if (name.endsWith(".module.css")) return styleModule();
  return require(name);
}

function styleModule() {
  return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
}
