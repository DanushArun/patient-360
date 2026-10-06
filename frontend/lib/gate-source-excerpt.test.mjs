import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../components/gate-source-excerpt.tsx', import.meta.url),
  'utf8');
const compiled = require('typescript').transpileModule(source, { compilerOptions: {
  jsx: require('typescript').JsxEmit.ReactJSX, module: require('typescript').ModuleKind.CommonJS,
} }).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, module, module.exports);
const span = { patient_id: 'PAT-1', scope: 'patient', assertion_id: 'ASSERT-1',
  doc_id: 'DOC-CBC', version: 1, page_index: 0,
  char_start: 11, char_end: 17, excerpt_start: 0, excerpt: 'Platelets: 82,000 /µL.',
  known_as_of: '2026-10-01T09:42:00', verification_status: 'verified' };
const gate = { evidence_ids: ['ASSERT-1'], known_as_of: span.known_as_of, source_spans: [span] };

test('test_gate_source_when_snapshot_differs_strips_the_excerpt', () => {
  assert.deepEqual(module.exports.readGateSourceSpans({ ...gate,
    source_spans: [{ ...span, known_as_of: '2026-09-30T09:42:00' }] }, 'PAT-1'), []);
});

test('test_gate_source_when_assertion_is_unrelated_strips_the_excerpt', () => {
  assert.deepEqual(module.exports.readGateSourceSpans({ ...gate, evidence_ids: ['OTHER'] },
    'PAT-1'), []);
});

test('test_gate_source_when_evidence_ids_are_malformed_strips_the_excerpt', () => {
  assert.deepEqual(module.exports.readGateSourceSpans({ ...gate, evidence_ids: 'ASSERT-1' },
    'PAT-1'), []);
});

test('test_gate_source_when_coordinates_are_invalid_strips_the_excerpt', () => {
  assert.deepEqual(module.exports.readGateSourceSpans({ ...gate,
    source_spans: [{ ...span, char_end: 99999 }] }, 'PAT-1'), []);
});

test('test_gate_source_when_assertion_is_unverified_strips_the_excerpt', () => {
  assert.deepEqual(module.exports.readGateSourceSpans({ ...gate,
    source_spans: [{ ...span, verification_status: 'pending' }] }, 'PAT-1'), []);
});

test('test_gate_source_when_patient_differs_strips_the_excerpt', () => {
  assert.deepEqual(module.exports.readGateSourceSpans(gate, 'PAT-2'), []);
});

test('test_gate_source_when_scope_is_reference_strips_the_excerpt', () => {
  assert.deepEqual(module.exports.readGateSourceSpans({ ...gate,
    source_spans: [{ ...span, scope: 'reference' }] }, 'PAT-1'), []);
});

test('test_gate_source_when_validated_shows_exact_value_and_bound_source_link', () => {
  const markup = renderToStaticMarkup(React.createElement(module.exports.GateSourceExcerpt,
    { gate, patientId: 'PAT-1' }));
  assert.match(markup, /<mark>82,000<\/mark>.*known_as_of=.*start=11.*end=17/s);
});
