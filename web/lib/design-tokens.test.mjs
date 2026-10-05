import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Enforces docs/design/INTERFACE-GUIDELINES.md: every visual value comes from
// app/tokens.css. A violation here means a screen has drifted off the system.
const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPACE = new Set([0, 1, 2, 4, 8, 12, 16, 24, 32, 48]);

function cssFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name.startsWith('test-') ? [] : cssFiles(full);
    return name.endsWith('.css') && name !== 'tokens.css' ? [full] : [];
  });
}

function declarations(file) {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  return [...css.matchAll(/([a-z-]+)\s*:\s*([^;{}]+)/g)]
    .map(([, property, value]) => ({ property, value: value.trim() }));
}

export function violations(file) {
  const found = [];
  for (const { property, value } of declarations(file)) {
    if (/#[0-9a-f]{3,8}\b/i.test(value) && !value.startsWith('url(')) {
      found.push(`${property}: ${value} (raw colour; use a colour token)`);
    }
    if (property === 'font-size' && /\d+(px|rem)/.test(value)) {
      found.push(`font-size: ${value} (use a --text-* style)`);
    }
    if (property === 'line-height' && /\d+px/.test(value)) {
      found.push(`line-height: ${value} (use a --text-* style)`);
    }
    if (property.endsWith('radius') && /\d+(px|rem)/.test(value)) {
      found.push(`${property}: ${value} (use a --radius-* token)`);
    }
    if (/^(padding|margin|gap|row-gap|column-gap)(-|$)/.test(property)) {
      for (const [, n] of value.matchAll(/(-?\d+(?:\.\d+)?)px/g)) {
        if (!SPACE.has(Math.abs(Number(n)))) found.push(`${property}: ${value} (off the 4 px scale)`);
      }
    }
    if (/height$/.test(property) && /^(36|38|40|42|44|46)px$/.test(value)) {
      found.push(`${property}: ${value} (controls use --control-height)`);
    }
  }
  return found;
}

test('every stylesheet uses only design tokens', () => {
  const report = cssFiles(path.join(web, 'app')).concat(cssFiles(path.join(web, 'components')))
    .map((file) => ({ file: path.relative(web, file), found: violations(file) }))
    .filter((entry) => entry.found.length);
  assert.deepEqual(report.map((entry) => `${entry.file}: ${entry.found.length}`), []);
});

function scriptFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name.startsWith('test-') ? [] : scriptFiles(full);
    return /\.(tsx|ts|mjs)$/.test(name) && !/\.test\./.test(name) ? [full] : [];
  });
}

test('components and scripts carry no raw colours or touch-size controls', () => {
  const offenders = ['app', 'components', 'lib'].flatMap((dir) => scriptFiles(path.join(web, dir)))
    .flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      const found = [...source.matchAll(/(?<!&)#[0-9a-fA-F]{6}\b|minHeight:\s*44\b|fontSize:\s*\d+/g)];
      return found.map((match) => `${path.relative(web, file)}: ${match[0]}`);
    });
  assert.deepEqual(offenders, []);
});

test('tokens define both appearances for every colour', () => {
  const tokens = readFileSync(path.join(web, 'app/tokens.css'), 'utf8');
  const [light, dark] = tokens.split('@media (prefers-color-scheme: dark)');
  const names = (block) => new Set([...block.matchAll(/--([a-z0-9-]+):\s*#/g)].map((m) => m[1]));
  assert.deepEqual([...names(light)].filter((name) => !names(dark).has(name)), []);
});
