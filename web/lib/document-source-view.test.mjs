import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

import { documentRequest, readDocumentPage } from "./document-source.mjs";

const require = createRequire(import.meta.url);
const source = readFileSync(new URL("../components/document-source-view.tsx", import.meta.url),
  "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

function loadSourceView() {
  const module = { exports: {} };
  const Link = ({ href, children }) => require("react").createElement("a", { href }, children);
  const Page = ({ children }) => require("react").createElement("main", null, children);
  const mockedRequire = (name) => {
    if (name === "next/link") return { __esModule: true, default: Link };
    if (name === "@/components/sa") return { Page, WorkspaceNav: () => null };
    return require(name);
  };
  new Function("require", "module", "exports", compiled)(
    mockedRequire, module, module.exports,
  );
  return module.exports.DocumentSourceView;
}

function sourceFixture(start, end) {
  const text = "Lab result: Cited result. Other page text.";
  const row = { DOC_ID: "DOC-1", PAGE_INDEX: 2, TEXT: text, SCOPE: "patient",
    VERSION: 3, EVENT_TIME: "2026-09-22T09:00:00",
    SOURCE_RECORDED_AT: "2026-09-22T10:00:00", INGESTED_AT: "2026-09-22T10:10:00",
    DOCUMENT_STATUS: "superseded", STATUS_OBSERVED_AT: "2026-09-25T12:00:00" };
  const request = documentRequest("DOC-1", { page: "2", start, end,
    known_as_of: "2026-09-23T14:14:48" });
  return { text, request, source: readDocumentPage([row], request) };
}

function render(sourceData) {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const component = loadSourceView();
  return renderToStaticMarkup(React.createElement(component, {
    patientId: "PAT-1", source: sourceData.source,
    returnHref: "/patient/PAT-1#ask-record", knownAsOf: "2026-09-23T14:14:48",
  }));
}

test("test_source_view_when_exact_span_is_cited_marks_only_that_span", () => {
  const text = "Lab result: Cited result. Other page text.";
  const cited = "Cited result";
  const start = text.indexOf(cited);
  const markup = render(sourceFixture(String(start), String(start + cited.length)));

  const markedText = markup.match(/<mark>(.*?)<\/mark>/)?.[1];
  assert.equal(markedText, cited);
});

test("test_source_view_when_citation_has_long_context_bounds_excerpt_around_exact_span", () => {
  const before = "A".repeat(500);
  const cited = "Exact cited phrase";
  const after = "B".repeat(500);
  const data = sourceFixture(undefined, undefined);
  data.source = { ...data.source, highlight: { before, cited, after } };
  const markup = render(data);

  assert.match(markup, /…<\/span>A{360}<mark>Exact cited phrase<\/mark>/);
  assert.match(markup, /<mark>Exact cited phrase<\/mark>B{360}<span aria-hidden="true">…<\/span>/);
  assert.doesNotMatch(markup, new RegExp(`A{361}|B{361}`));
  assert.match(markup, /up to 360 characters of surrounding context/);
});

test("test_source_view_when_history_is_open_preserves_cutoff_status_clocks_and_safe_return", () => {
  const { text, request, source } = sourceFixture(undefined, undefined);
  const markup = render({ source });

  assert.match(markup, /Known as of: 2026-09-23T14:14:48/);
  assert.match(markup, /Current document status: superseded/);
  assert.match(markup, /Event time/);
  assert.match(markup, /Source recorded/);
  assert.match(markup, /Ingested/);
  assert.match(markup, /href="\/patient\/PAT-1#ask-record"/);
  assert.match(markup, /Back to patient record/);
  assert.match(markup, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(request.argument, "DOC-1|2026-09-23T14:14:48");
});

test("test_source_view_when_span_is_missing_does_not_claim_exact_highlight", () => {
  const data = sourceFixture(undefined, undefined);
  const markup = render(data);

  assert.match(markup, /No exact citation span was supplied/);
  assert.doesNotMatch(markup, /<mark>/);
});
