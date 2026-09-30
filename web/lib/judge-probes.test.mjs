import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateProbe } from './judge-probes.mjs';

test('aggregate probes inspect counts rather than returned row count', () => {
  assert.equal(evaluateProbe(3, [{ DANGLING_BINDINGS: 0 }]), true);
  assert.equal(evaluateProbe(3, [{ DANGLING_BINDINGS: 1 }]), false);
  assert.equal(evaluateProbe(4, [{ MISSING_CLOCKS: 0 }]), true);
  assert.equal(evaluateProbe(4, [{ MISSING_CLOCKS: 2 }]), false);
  assert.equal(evaluateProbe(3, []), false);
  assert.equal(evaluateProbe(4, [{}]), false);
});
test('consent inventory is informational, not evidence of refused bindings', () => {
  assert.equal(evaluateProbe(6, []), null);
});

test('distribution requires the four actual known outcomes', () => {
  const rows = ['pass', 'fail', 'conflicting', 'not_evaluated'].map(OUTCOME => ({ OUTCOME }));
  assert.equal(evaluateProbe(7, rows), true);
  assert.equal(evaluateProbe(7, Array(4).fill({ OUTCOME: 'pass' })), false);
});
