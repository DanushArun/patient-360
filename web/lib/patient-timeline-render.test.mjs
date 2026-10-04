import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as factHelpers from './workspace-patient-facts.mjs';
const require = createRequire(import.meta.url);
const src = readFileSync(new URL('../app/patient/[id]/patient-timeline.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(src, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
} }).outputText;
const module = { exports: {} };
const dependencies = (path) => path === '@/lib/workspace-patient-facts.mjs' ? factHelpers
  : path.startsWith('@/') ? {} : require(path);
new Function('require', 'module', 'exports', compiled)(dependencies, module, module.exports);
const clock = '2026-09-23T14:14:48';
const event = { concept: 'HER2', value: null, value_state: 'present', value_text: 'IHC 2+',
  is_derived: false, event_id: 'EV-1', event_time: clock, source_recorded_at: clock,
  ingested_at: clock };
function render(patch = {}, metadata = {}) {
  return renderToStaticMarkup(React.createElement(module.exports.PatientTimelineContent,
    { data: { timeline: [{ ...event, ...patch }], known_as_of: clock, ...metadata } }));
}

test('test_timeline_when_qualitative_result_present_displays_recorded_text', () => {
  assert.match(render(), /IHC 2\+/);
});

test('test_timeline_when_numeric_derived_displays_unit_formula_and_sources', () => {
  const html = render({ concept: 'ANC', value: 2.5, value_text: null, unit: '10^9/L',
    is_derived: true, derivation: 'WBC × neutrophils / 100',
    source_event_ids: ['EV-WBC'], source_assertion_ids: ['ASSERT-1'],
    source_document_ids: ['DOC-1'], source_links_observed_at: clock });
  assert.deepEqual(['2.5', '10^9/L', 'WBC × neutrophils / 100', 'EV-WBC', 'ASSERT-1', 'DOC-1']
    .map((text) => html.includes(text)), Array(6).fill(true));
});

test('test_timeline_when_pending_displays_missingness_without_value', () => {
  assert.match(render({ value_state: 'pending', value_text: null }), /Pending/);
});

test('test_timeline_when_truncated_discloses_total_and_limit', () => {
  assert.match(render({}, { total_events: 250, timeline_limit: 100, truncated: true }),
    /Showing 1 of 250 recorded events/);
});

test('test_timeline_when_state_missing_never_claims_not_received', () => {
  const html = render({ value_state: 'state_unavailable', value: -0.8, value_text: null });
  assert.doesNotMatch(html, /Not received/);
  assert.match(html, /State unavailable/);
});
