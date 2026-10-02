import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as documents from './workspace-documents.mjs';
import * as dates from './workspace-record-date.mjs';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../components/overview-record-inventory.tsx',
  import.meta.url), 'utf8');
const compiled = require('typescript').transpileModule(source, { compilerOptions: {
  jsx: require('typescript').JsxEmit.ReactJSX, module: require('typescript').ModuleKind.CommonJS,
} }).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)(dependency, module, module.exports);

function dependency(name) {
  if (name === './workspace-patient-data') return { useWorkspaceData: () => ({
    data: null, state: 'loading', retry: () => {},
  }) };
  if (name === '@/lib/workspace-documents.mjs') return documents;
  if (name === '@/lib/workspace-record-date.mjs') return dates;
  if (name.endsWith('.module.css')) return { __esModule: true, default: {} };
  return require(name);
}

function renderRows(rows) {
  return renderToStaticMarkup(React.createElement(module.exports.InventoryTable, {
    rows, patientId: 'PAT-DC-04', knownAsOf: '2026-10-01T09:42:00',
  }));
}

test('test_inventory_when_received_and_expected_records_return_keeps_missingness_distinct', () => {
  const rows = documents.documentLibraryRows([{ doc_id: 'DOC-1', doc_type: 'CBC',
    missingness_state: 'present', page_count: 1, source_facility: 'Synthetic laboratory',
    verified_assertions: 2 }], [{ title: 'Final pathology', rule_id: 'DOC-PATH-001',
    missingness_state: 'not_received', reason: 'Awaiting report' }]);
  const markup = renderRows(rows);
  assert.deepEqual(['Present', 'Not received', 'Awaiting report', 'Synthetic laboratory']
    .map((value) => markup.includes(value)), Array(4).fill(true));
});

test('test_inventory_when_source_is_opened_keeps_document_and_snapshot_bound', () => {
  const markup = renderRows(documents.documentLibraryRows([{ doc_id: 'DOC-1',
    doc_type: 'CBC', page_count: 1 }], []));
  assert.match(markup, /\/patient\/PAT-DC-04\/documents\/DOC-1\?page=0.*known_as_of=/);
});

test('test_inventory_when_no_source_metadata_returns_does_not_invent_document', () => {
  const markup = renderRows(documents.documentLibraryRows([], [{ title: 'Final pathology',
    rule_id: 'DOC-PATH-001', missingness_state: 'not_received' }]));
  assert.doesNotMatch(markup, /href=|verified|City Labs/);
});
