import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as documents from './workspace-documents.mjs';
import * as facts from './workspace-patient-facts.mjs';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../components/evidence-packet-preview.tsx',
  import.meta.url), 'utf8');
const compiled = require('typescript').transpileModule(source, { compilerOptions: {
  jsx: require('typescript').JsxEmit.ReactJSX, module: require('typescript').ModuleKind.CommonJS,
} }).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)(dependency, module, module.exports);
const cutoff = '2026-10-01T09:42:00';

function dependency(name) {
  if (name === './workspace-patient-facts') return { useFactsData: () => ({
    current: { state: 'ready', data: { facts: [{ concept: 'Platelets', value: 82000,
      value_state: 'present', unit: '/µL', event_id: 'EVT-1' }] } }, retry: () => {},
  }) };
  if (name === './workspace-patient-data') return { useWorkspaceData: () => ({
    data: { rows: [{ doc_id: 'DOC-1', doc_type: 'CBC', missingness_state: 'present',
      page_count: 1 }] }, state: 'ready', retry: () => {},
  }) };
  if (name === '@/lib/workspace-documents.mjs') return documents;
  if (name === '@/lib/workspace-patient-facts.mjs') return facts;
  return require(name);
}

function render(knownAsOf = cutoff) {
  return renderToStaticMarkup(React.createElement(module.exports.EvidencePacketPreview, {
    patient: { patientId: 'PAT-1', patientName: 'Synthetic patient', knownAsOf: cutoff,
      gates: [{ rule_id: 'CLIN-PLT-001', rule_version: 1, outcome: 'fail',
        reason: 'Platelet check below threshold' }] },
    recipient: 'Dr Example', knownAsOf,
  }));
}

test('test_packet_preview_when_snapshots_match_shows_returned_facts_and_draft_boundary', () => {
  const markup = render();
  assert.deepEqual(['Draft · Not created', '82000', 'CLIN-PLT-001', 'Source index',
    'Dr Example'].map((text) => markup.includes(text)), Array(5).fill(true));
});

test('test_packet_preview_when_answer_cutoff_differs_does_not_mix_current_record', () => {
  const markup = render('2026-09-30T09:42:00');
  assert.doesNotMatch(markup, /82000|CLIN-PLT-001|href=/);
});

test('test_packet_preview_when_source_opens_preserves_patient_cutoff_and_ask_return', () => {
  assert.match(render(), /\/patient\/PAT-1\/documents\/DOC-1\?page=0.*return=ask/);
});
