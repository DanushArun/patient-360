import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import * as factHelpers from "./workspace-patient-facts.mjs";

const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");
const factsModule = loadFactsModule();

test("rendered Facts result keeps SQL lab values, state, clocks and source return together", () => {
  const markup = renderFacts({
    domain: "labs",
    data: {
      domain: "labs", known_as_of: "2026-09-23T14:14:48",
      requested_known_as_of: "2026-09-23T14:14:48", as_of_semantics: "ingested_cutoff",
      facts: [{ concept: "ANC", value: 2100, value_state: "present", value_text: null,
        unit: "/µL", is_derived: true, derivation: "SQL-derived from returned source events",
        event_time: "2026-09-30T08:30:00", source_recorded_at: "2026-09-30T09:00:00",
        ingested_at: "2026-09-30T09:20:00", event_id: "EVT-ANC-1",
        source_event_ids: ["EVT-WBC-1", "EVT-NEUT-1"], source_assertion_ids: ["ASSERT-ANC-1"],
        source_document_ids: ["DOC-CBC-1"] },
      { concept: "Final pathology", value: 3, value_state: "not_received", value_text: null,
        unit: null, event_time: null, source_recorded_at: null, ingested_at: null,
        event_id: "EVT-PATH-1", source_document_ids: [] }],
    },
    patientId: "PAT-DC-04", knownAsOf: "2026-09-23T14:14:48",
    openFact: "EVT-ANC-1", onToggleFact: () => {},
  });

  assert.match(markup, /Lab records/);
  assert.match(markup, />2100</);
  assert.match(markup, /SQL-derived from returned source events/);
  assert.match(markup, /Not received/);
  assert.match(markup, /2026-09-30T09:20:00/);
  assert.match(markup, /EVT-WBC-1, EVT-NEUT-1/);
  assert.match(markup,
    /DOC-CBC-1\?page=0&amp;known_as_of=2026-09-23T14%3A14%3A48&amp;return=facts/);
});

test("rendered current domain states that its requested cutoff does not apply", () => {
  const markup = renderFacts({ domain: "coverage", data: {
    domain: "coverage", facts: [{ payer_name: "Returned payer", annual_limit: 100000 }],
    known_as_of: "2026-10-02T09:00:00", requested_known_as_of: "2026-09-23T14:14:48",
    as_of_semantics: "current_at_query",
  }, patientId: "PAT-DC-04", knownAsOf: "2026-09-23T14:14:48",
  openFact: null, onToggleFact: () => {} });

  assert.match(markup, /Current facts read at 2026-10-02T09:00:00/);
  assert.match(markup, /requested historical cutoff does not apply/);
  assert.match(markup, /Returned payer/);
});

function renderFacts(props) {
  return renderToStaticMarkup(React.createElement(factsModule.FactsResult, props));
}

function loadFactsModule() {
  const path = fileURLToPath(new URL("../components/workspace-patient-facts.tsx", import.meta.url));
  const source = readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: {
    jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(compiled, { exports: module.exports, module,
    require: componentDependency });
  return module.exports;
}

function componentDependency(name) {
  if (name === "@/lib/workspace-patient-facts.mjs") return factHelpers;
  if (name === "@/lib/workspace-state.mjs") {
    return { announcePatientAccessWithdrawn: () => {}, purgesPatientState: () => false };
  }
  if (name.endsWith(".module.css")) return styleModule();
  return require(name);
}

function styleModule() {
  const classes = new Proxy({}, { get: (_, name) => String(name) });
  return { __esModule: true, default: classes };
}
