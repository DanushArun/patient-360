import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../components/record-change-history.tsx', import.meta.url),
  'utf8');
const compiled = require('typescript').transpileModule(source, { compilerOptions: {
  jsx: require('typescript').JsxEmit.ReactJSX, module: require('typescript').ModuleKind.CommonJS,
} }).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)(require, module, module.exports);
const before = { known_as_of: '2026-10-01T09:42:00', rule_id: 'COV-AUTH-001',
  rule_version: 1, outcome: 'conflicting', reason: 'Two dates disagree.' };
const after = { ...before, known_as_of: '2026-10-02T10:00:00', outcome: 'pass',
  reason: 'Corrected authorization values agree.' };

test('test_record_changes_when_rule_identity_differs_rejects_the_comparison', () => {
  assert.equal(module.exports.readRecordChanges([{ before,
    after: { ...after, rule_id: 'CLIN-PLT-001' } }]), null);
});

test('test_record_changes_when_unknown_outcome_returns_does_not_infer_pass', () => {
  assert.equal(module.exports.readRecordChanges([{ before,
    after: { ...after, outcome: 'ready' } }]), null);
});

test('test_record_changes_when_valid_pair_returns_displays_both_cutoffs_and_source_values', () => {
  const changes = module.exports.readRecordChanges([{ before, after,
    fields: [{ label: 'Valid through', before: '30 Sep 2026', after: '5 Oct 2026' }] }]);
  const markup = renderToStaticMarkup(React.createElement(module.exports.RecordChangeHistory,
    { changes }));
  assert.deepEqual(['conflicting', 'pass', before.known_as_of, after.known_as_of,
    '30 Sep 2026', '5 Oct 2026'].map((value) => markup.includes(value)), Array(6).fill(true));
});
