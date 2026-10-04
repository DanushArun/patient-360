#!/usr/bin/env node
// Run one or more SQL files against Snowflake with connection details supplied at RUN TIME
// through environment variables. Nothing is read from disk except the SQL files you name (and
// the key/PAT file only if you point an env var at it); no credential is embedded or printed.
//
//   export SNOWFLAKE_ACCOUNT=<org-account> SNOWFLAKE_USER=<user> SNOWFLAKE_ROLE=<role>
//   read -rs SNOWFLAKE_PAT && export SNOWFLAKE_PAT      # typed at a hidden prompt: never on the command line
//   node backend/scripts/run-sql-from-env.mjs [--apply] FILE.sql [FILE2.sql ...]
//
// Secrets are never accepted as arguments and are not documented inline; a password is not
// supported at all. Auth (first one present wins): SNOWFLAKE_PAT (token value, set via the hidden
// prompt above), SNOWFLAKE_PAT_FILE (path to a file holding only the token), or
// SNOWFLAKE_PRIVATE_KEY_PATH (key-pair).
// SNOWFLAKE_ROLE is REQUIRED with --apply (no default). ACCOUNTADMIN is refused unless you pass
// --allow-accountadmin, because object DDL is the only reason to need it (use the least-privileged
// role that owns the objects). Optional: SNOWFLAKE_WAREHOUSE (default SAARTHI_AI_WH).
// Without --apply this is a dry run: it lists the statements and executes nothing.
// A network policy that blocks your IP still blocks this script; use the Snowsight path then.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { statements } from './bounded-session.mjs';

const require = createRequire(new URL('../../web/package.json', import.meta.url));
const sf = require('snowflake-sdk');

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const allowAdmin = args.includes('--allow-accountadmin');
const files = args.filter((a) => !a.startsWith('--'));
if (!files.length) { console.error('usage: run-sql-from-env.mjs [--apply] FILE.sql ...'); process.exit(2); }

const plan = files.flatMap((file) =>
  statements(readFileSync(file, 'utf8')).map((sql) => ({ file, sql })));
console.log(`${plan.length} statements from ${files.length} file(s)${apply ? '' : ' (dry run, nothing executed)'}`);
if (!apply) {
  for (const p of plan) console.log(`${p.file}: ${p.sql.replace(/\s+/g, ' ').slice(0, 110)}`);
  process.exit(0);
}

const env = process.env;
for (const name of ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER', 'SNOWFLAKE_ROLE']) {
  if (!env[name]) { console.error(`missing environment variable ${name}`); process.exit(2); }
}
if (/^ACCOUNTADMIN$/i.test(env.SNOWFLAKE_ROLE) && !allowAdmin) {
  console.error('refusing ACCOUNTADMIN without --allow-accountadmin; use the role that owns the objects');
  process.exit(2);
}
let auth;
if (!env.SNOWFLAKE_PAT && env.SNOWFLAKE_PAT_FILE) env.SNOWFLAKE_PAT = readFileSync(env.SNOWFLAKE_PAT_FILE, 'utf8').trim();
if (env.SNOWFLAKE_PAT) auth = { authenticator: 'PROGRAMMATIC_ACCESS_TOKEN', token: env.SNOWFLAKE_PAT };
else if (env.SNOWFLAKE_PRIVATE_KEY_PATH) {
  auth = { authenticator: 'SNOWFLAKE_JWT', privateKey: readFileSync(env.SNOWFLAKE_PRIVATE_KEY_PATH, 'utf8') };
} else { console.error('set SNOWFLAKE_PAT, SNOWFLAKE_PAT_FILE or SNOWFLAKE_PRIVATE_KEY_PATH'); process.exit(2); }

const conn = sf.createConnection({
  account: env.SNOWFLAKE_ACCOUNT, username: env.SNOWFLAKE_USER, ...auth,
  role: env.SNOWFLAKE_ROLE, warehouse: env.SNOWFLAKE_WAREHOUSE || 'SAARTHI_AI_WH',
});
const run = (sqlText) => new Promise((resolve, reject) => conn.execute({
  sqlText, complete: (error, _stmt, rows) => (error ? reject(error) : resolve(rows ?? [])),
}));
await new Promise((resolve, reject) => conn.connect((e) => (e ? reject(e) : resolve())));
try {
  await run('USE SECONDARY ROLES NONE');
  let n = 0;
  for (const p of plan) {
    n += 1;
    try { await run(p.sql); } catch (error) {
      console.error(`FAILED ${p.file} statement ${n}/${plan.length}: ${error.code ?? ''} ${error.message}`);
      process.exitCode = 1; break;
    }
  }
  if (!process.exitCode) console.log(`OK ${n} statements`);
} finally {
  await new Promise((resolve) => conn.destroy(() => resolve()));
}
