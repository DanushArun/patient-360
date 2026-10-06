import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const source = readFileSync(
  new URL("../app/patient/[id]/patient-answer-artifact.tsx", import.meta.url), "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;

function loadArtifact() {
  const module = { exports: {} };
  const Link = ({ href, children }) => React.createElement("a", { href }, children);
  const mockedRequire = (name) => name === "next/link"
    ? { __esModule: true, default: Link } : require(name);
  new Function("require", "module", "exports", compiled)(
    mockedRequire, module, module.exports,
  );
  return module.exports.PatientAnswerArtifact;
}

function citationTurn() {
  return { artifact: {
    classification: "CLASS_B", claims: [{
      text: "The signed report records this result.", claim_type: "textual",
      evidence: [{ kind: "document_span", id: "ASSERT-1", doc_id: "DOC-1",
        page_index: 2, char_start: 5, char_end: 18 }],
    }], limitations: [], overall_status: "supported",
    known_as_of: "2026-09-23T14:14:48",
  } };
}

test("test_structured_citation_when_rendered_exposes_source_clocks_and_sql_quote", () => {
  const turn = citationTurn();
  turn.artifact.claims[0] = {
    text: "Recorded SQL row: annual_limit 500000", claim_type: "textual",
    evidence: [{ kind: "structured", id: "ROW-COVERAGE--COV-1",
      table: "SAARTHI.CORE.COVERAGE", event_time: "2025-09-26",
      source_recorded_at: "not_received", ingested_at: "not_received" }],
  };
  const markup = renderToStaticMarkup(React.createElement(loadArtifact(), {
    turn, patientId: "PAT-1",
  }));
  assert.ok(["View cited SQL record", "SAARTHI.CORE.COVERAGE", "2025-09-26",
    "Source recorded at: not_received", "Ingested at: not_received",
    "Recorded SQL row: annual_limit 500000"].every(text => markup.includes(text)));
});

test("test_citation_link_when_answer_opens_source_keeps_cutoff_and_ask_return", () => {
  const component = loadArtifact();
  const markup = renderToStaticMarkup(React.createElement(component, {
    turn: citationTurn(), patientId: "PAT-1",
  }));
  const encodedHref = markup.match(/href="([^"]+)"/)?.[1];
  assert.ok(encodedHref);
  const href = encodedHref.replaceAll("&amp;", "&");
  const url = new URL(href, "https://patient.example");

  assert.equal(url.searchParams.get("known_as_of"), "2026-09-23T14:14:48");
  assert.equal(url.searchParams.get("return"), "ask");
  assert.equal(url.searchParams.get("start"), "5");
  assert.equal(url.searchParams.get("end"), "18");
  assert.match(markup, /Patient document/);
  assert.match(markup, /Text span 5–18/);
  assert.match(markup, /Known as of <time datetime="2026-09-23T14:14:48"[^>]*>23 Sept 2026, 14:14<\/time>/i);
});

test("test_partial_answer_when_claims_and_limitations_exist_shows_observed_status", () => {
  const component = loadArtifact();
  const turn = citationTurn();
  turn.artifact.overall_status = "partial";
  turn.artifact.limitations = ["Final report not received"];
  const markup = renderToStaticMarkup(React.createElement(component, {
    turn, patientId: "PAT-1",
  }));

  assert.match(markup, /Answer status: Partial/);
  assert.match(markup, /Final report not received/);
});

test("test_tool_payload_when_artifact_is_rendered_is_not_shown_as_claim", () => {
  const component = loadArtifact();
  const turn = citationTurn();
  turn.tool_results = [{ name: "SearchPatientDocuments", result: {
    text: "Unvalidated raw search prose",
  } }];
  const markup = renderToStaticMarkup(React.createElement(component, {
    turn, patientId: "PAT-1",
  }));

  assert.doesNotMatch(markup, /Unvalidated raw search prose/);
  assert.match(markup, /The signed report records this result/);
});

test("test_refused_answer_when_class_a_is_returned_shows_practitioner_referral", () => {
  const component = loadArtifact();
  const turn = citationTurn();
  turn.artifact.classification = "CLASS_A";
  turn.artifact.overall_status = "refused";
  turn.artifact.refusal = {
    reason_code: "class_a_clinical_judgment",
    message: "This clinical decision must be made by the practitioner.",
    practitioner: { practitioner_id: "P-1", name: "Dr Meera Iyer",
      nmc_registration_no: "NMC-TEST-1" },
    evidence_packet_offered: true,
  };
  const markup = renderToStaticMarkup(React.createElement(component, {
    turn, patientId: "PAT-1",
  }));

  assert.match(markup, /Answer status: Refused/);
  assert.match(markup, /Clinical decision for Dr Meera Iyer/);
  assert.match(markup, /evidence packet can be prepared/);
});

test("test_turn_error_when_artifact_is_unavailable_shows_recoverable_failure", () => {
  const component = loadArtifact();
  const markup = renderToStaticMarkup(React.createElement(component, {
    turn: { error: "answer_unavailable" }, patientId: "PAT-1",
  }));

  assert.match(markup, /role="alert"/);
  assert.match(markup, /Answer unavailable: answer_unavailable/);
});

test('test_reference_citation_when_rendered_distinguishes_guidance_from_patient_record', () => {
  const turn = citationTurn();
  turn.artifact.claims[0].evidence = [{ kind: 'reference_clause', id: 'REF-1',
    doc_id: 'REF-DOC-1', page_index: 0, publisher: 'Government of Gujarat',
    document_title: 'Standard Treatment Guidelines', version: '2013',
    jurisdiction: 'IN', effective_date: 'not_received' }];
  const markup = renderToStaticMarkup(React.createElement(loadArtifact(), {
    turn, patientId: 'PAT-1',
  }));
  assert.ok(markup.includes('Reference quotation') && markup.includes('Government of Gujarat')
    && markup.includes('Standard Treatment Guidelines') && markup.includes('2013')
    && markup.includes('Effective date: not_received') && !markup.includes('Structured record'));
});

test('test_rule_claim_when_rendered_keeps_version_and_practice_qualification_visible', () => {
  const turn = citationTurn();
  turn.artifact.claims[0] = { text: 'SQL record check CLIN-PLT-001 version 1: fail.',
    claim_type: 'textual', rule_id: 'CLIN-PLT-001', rule_version: 1, outcome: 'fail',
    provenance_note: 'Practice consensus; protocol overrides are not modelled.',
    evidence: [{ kind: 'structured', id: 'RULE--ENC-1--CLIN-PLT-001--1',
      table: 'SAARTHI.OPERATIONAL.RULE_CATALOG', event_time: 'not_received',
      source_recorded_at: 'not_received', derived: 'GET_READINESS; source IDs [EVT-1]' }] };
  const markup = renderToStaticMarkup(React.createElement(loadArtifact(), {
    turn, patientId: 'PAT-1',
  }));
  assert.ok(markup.includes('Rule: CLIN-PLT-001 · version 1')
    && markup.includes('Practice consensus; protocol overrides are not modelled.')
    && markup.includes('GET_READINESS; source IDs [EVT-1]'));
});
