import { copyFile, mkdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const source = path.dirname(fileURLToPath(import.meta.url));
const repository = await realpath(path.join(source, '../..'));
const target = await realpath(process.argv[2] ?? '');
if (!process.argv[2] || target === repository || target.startsWith(repository + path.sep)) {
  throw new Error('Supply an isolated checkout outside the working repository.');
}

const routes = {
  'workspace-page.tsx': 'test-workspace/[id]',
  'daycare-page.tsx': 'test-daycare',
  'source-page.tsx': 'test-source',
  'history-page.tsx': 'test-history/[id]',
  'queue-page.tsx': 'test-queue',
};

for (const [fixture, route] of Object.entries(routes)) {
  const destination = path.join(target, 'frontend/app', route);
  await mkdir(destination, { recursive: true });
  await copyFile(path.join(source, 'fixtures', fixture), path.join(destination, 'page.tsx'));
}
console.log('Installed five synthetic UI test routes in the isolated checkout.');
