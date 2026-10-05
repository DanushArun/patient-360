import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

function load() {
  delete globalThis.__saarthiReadCache;
  const source = ts.transpileModule(readFileSync(new URL('./read-cache.ts', import.meta.url), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const module = { exports: {} };
  new Function('module', 'exports', source)(module, module.exports);
  return module.exports;
}

test('repeat and concurrent reads share one load', async () => {
  const { cachedRead } = load();
  let loads = 0;
  const read = () => cachedRead('P1', 'timeline', async () => ++loads);
  assert.deepEqual(await Promise.all([read(), read()]), [1, 1]);
  assert.equal(await read(), 1);
  assert.equal(loads, 1);
});

test('entries are per patient and per name', async () => {
  const { cachedRead } = load();
  assert.equal(await cachedRead('P1', 'a', async () => 'p1a'), 'p1a');
  assert.equal(await cachedRead('P2', 'a', async () => 'p2a'), 'p2a');
  assert.equal(await cachedRead('P1', 'b', async () => 'p1b'), 'p1b');
});

test('a write invalidates, and a read that began before the write cannot repopulate', async () => {
  const { cachedRead, invalidatePatient } = load();
  let release;
  const slow = cachedRead('P1', 'x', () => new Promise(resolve => { release = resolve; }));
  invalidatePatient('P1');
  release('stale');
  await slow;
  assert.equal(await cachedRead('P1', 'x', async () => 'fresh'), 'fresh');
});

test('errors are not cached', async () => {
  const { cachedRead } = load();
  await assert.rejects(cachedRead('P1', 'x', async () => { throw new Error('down'); }), /down/);
  assert.equal(await cachedRead('P1', 'x', async () => 'ok'), 'ok');
});
