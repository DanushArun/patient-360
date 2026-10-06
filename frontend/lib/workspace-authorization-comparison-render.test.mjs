import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import * as readHelpers from "./workspace-authorization-read.mjs";
import * as dateHelpers from "./workspace-record-date.mjs";

const componentPath = fileURLToPath(new URL(
  "../components/workspace-authorization-comparison.tsx", import.meta.url));

test(
  "test_authorization_comparison_when_sources_disagree_renders_both_clocks_and_exact_link",
  () => {
  assert.ok(existsSync(componentPath), "authorization comparison screen is not implemented");
  const component = loadComponent();
  const markup = render(component, { patientId: "PAT-DC-04", patientName: "Fatima Begum",
    cutoff: "2026-10-01T09:42:00", data: {
      known_as_of: "2026-10-01T09:42:00", requested_known_as_of: "2026-10-01T09:42:00",
      as_of_semantics: "authorization_current_at_query_document_ingestion_cutoff",
      observed_at: "2026-10-01T09:42:05",
      rule: { rule_id: "COV-AUTH-001", rule_version: 1, outcome: "conflicting",
        reason: "Structured and letter dates disagree.",
        known_as_of: "2026-10-01T09:42:00" },
      authorizations: [{ auth_id: "AUTH-1", expires_at: "2026-10-05T00:00:00",
        payer_name: "HealthSure TPA (synthetic)", decided_at: "2026-09-28T00:00:00",
        observed_at: "2026-10-01T09:42:05" }],
      letters: [{ assertion_id: "ASSERT-1", value: "30 Sep 2026", predicate: "valid_until",
        verification_status: "verified", source_link_status: "verified_assertion_exact_page_span",
        doc_id: "DOC-AUTH-1", page_index: 0, char_start: 28, char_end: 39, excerpt_start: 0,
        source_facility: "HealthSure TPA (synthetic)", event_time: "2026-09-28T00:00:00",
        source_recorded_at: "2026-09-28T00:00:00", ingested_at: "2026-09-29T16:20:00",
        excerpt: `${"x".repeat(28)}30 Sep 2026 after context` }],
    }, onBack: () => {}, onEscalate: () => {} });

  assert.match(markup, /Structured authorization/);
  assert.match(markup, /5 Oct 2026/);
  assert.match(markup, /30 Sep 2026/);
  assert.match(markup, /28 Sept 2026, 00:00/);
  assert.match(markup, /29 Sept 2026, 16:20/);
  assert.match(markup, /No single valid-through date is asserted/);
  assert.match(markup, /<h2>Authorization dates disagree<\/h2>/);
  assert.match(markup, /SQL rule snapshot: 1 Oct 2026, 09:42/);
  assert.match(markup, /<mark>30 Sep 2026<\/mark>/);
  const sourceHref = ["DOC-AUTH-1\\?page=0&amp;known_as_of=2026-10-01T09%3A42%3A00",
    "&amp;return=coverage-comparison&amp;start=28&amp;end=39"].join("");
  assert.match(markup, new RegExp(sourceHref));
  assert.doesNotMatch(markup, /30 Sep 2026.*5 Oct 2026/s);
  },
);

test("test_authorization_comparison_when_valid_until_is_absent_does_not_invent_a_date", () => {
  assert.ok(existsSync(componentPath), "authorization comparison screen is not implemented");
  const component = loadComponent();
  const markup = render(component, { patientId: "PAT-DC-04", patientName: "Fatima Begum",
    cutoff: "2026-10-01T09:42:00", data: {
      known_as_of: "2026-10-01T09:42:00", requested_known_as_of: "2026-10-01T09:42:00",
      rule: { rule_id: "COV-AUTH-001", rule_version: 1, outcome: "not_evaluated",
        known_as_of: "2026-10-01T09:42:00" },
      authorizations: [{ auth_id: "AUTH-1", expires_at: null }], letters: [],
    }, onBack: () => {}, onEscalate: () => {} });

  assert.match(markup, /No expiry date recorded/);
  assert.match(markup, /No verified valid-through assertion was returned/);
  assert.match(markup, /<h2>Compare authorization sources<\/h2>/);
  assert.match(markup, /Source values remain shown separately/);
  assert.doesNotMatch(markup, /No single valid-through date is asserted/);
  assert.doesNotMatch(markup, /30 Sep 2026|5 Oct 2026/);
});

function render(component, props) {
  const React = createRequire(import.meta.url)("react");
  return createRequire(import.meta.url)("react-dom/server")
    .renderToStaticMarkup(React.createElement(component, props));
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
    require: componentDependency(require) });
  return module.exports.AuthorizationComparisonContent;
}

function componentDependency(require) {
  return (name) => {
    if (name === "next/link") return { __esModule: true,
      default: ({ href, children, ...props }) => require("react").createElement("a",
        { href, ...props }, children) };
    if (name.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, {
      get: (_, key) => String(key),
    }) };
    if (name === "@/lib/workspace-authorization-read.mjs") return readHelpers;
    if (name === "@/lib/workspace-record-date.mjs") return dateHelpers;
    if (name === "@/components/use-workspace-authorization-comparison") {
      return { useWorkspaceAuthorizationComparison: () => ({ current: {}, retry: () => {} }) };
    }
    return require(name);
  };
}
