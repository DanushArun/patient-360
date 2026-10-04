// Runs the Playwright suite against an ISOLATED copy of web/ that has the synthetic test routes
// (/test-daycare, /test-workspace, /test-source, /test-history, /test-queue) installed.
// Those routes are fixtures; they must never exist in the shipping app, so they are installed
// only into a throwaway copy outside the repository (prepare-fixtures.mjs refuses anything else).
// Usage: npm run test:e2e [-- <playwright args>]     Needs: npx playwright install chromium
import { cp, mkdtemp, mkdir, rm, symlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = await mkdtemp(path.join(tmpdir(), 'saarthi-e2e-'));
const copy = path.join(root, 'web');
// Never copy dependencies, build output, local logs or any environment/credential file.
const skip = new Set(['node_modules', '.next', 'test-results', 'playwright-report',
  'snowflake.log', 'tsconfig.tsbuildinfo']);
const excluded = (name) => skip.has(name) || name.startsWith('.env');
let status = 1;
try {
  await mkdir(copy, { recursive: true });
  await cp(web, copy, { recursive: true,
    filter: (source) => !excluded(path.basename(source)) });
  // web/ imports two repository-level JSON files by relative path; copy exactly those, nothing else.
  const repo = path.resolve(web, '..');
  for (const rel of ['frontend/fixtures/daycare_census_recorded.json',
    'frontend/contracts/answer_schema.json']) {
    await mkdir(path.dirname(path.join(root, rel)), { recursive: true });
    await cp(path.join(repo, rel), path.join(root, rel));
  }
  await symlink(path.join(web, 'node_modules'), path.join(copy, 'node_modules'), 'dir');
  const run = (command, args, env = {}) => spawnSync(command, args, {
    cwd: copy, stdio: 'inherit', env: { ...process.env, SAARTHI_SNOWFLAKE_ENABLED: 'false', ...env },
  }).status ?? 1;
  const env = { SAARTHI_SNOWFLAKE_ENABLED: 'false' };
  if (spawnSync('node', ['tests/prepare-fixtures.mjs', root], { cwd: web, stdio: 'inherit' })
    .status !== 0) throw new Error('fixture install failed');
  if (run('npx', ['next', 'build', '--webpack'], env) !== 0) throw new Error('build failed');
  status = run('npx', ['playwright', 'test', ...process.argv.slice(2)], env);
} finally {
  await rm(root, { recursive: true, force: true });
}
process.exit(status);
