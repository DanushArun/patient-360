#!/usr/bin/env node
// Account-pinned SQL-only deployment. Search and AI invocation are deferred.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const require = createRequire(new URL('../../web/package.json', import.meta.url));
const snowflake = require('snowflake-sdk');
snowflake.configure({ logLevel: 'ERROR' });
const root = fileURLToPath(new URL('../sql/', import.meta.url));
const repo = resolve(root, '../..');

// Recognizes quoted strings, identifiers, procedure bodies and comments.
function statements(source) {
  let state = '', part = '', out = [];
  for (let i = 0; i < source.length; i++) {
    const c = source[i], n = source[i + 1];
    if (state === 'line') { if (c === '\n') { state = ''; part += '\n'; } continue; }
    if (state === 'comment') { if (c === '*' && n === '/') { state = ''; i++; part += ' '; } continue; }
    if (state === '$$') { part += c; if (c === '$' && n === '$') { part += n; i++; state = ''; } continue; }
    if (state === "'" || state === '"') {
      part += c;
      if (c === '\\' && n) { part += n; i++; continue; }
      if (c === state) { if (n === state) { part += n; i++; } else state = ''; }
      continue;
    }
    if (c === '-' && n === '-') { state = 'line'; i++; continue; }
    if (c === '/' && n === '*') { state = 'comment'; i++; continue; }
    if (c === '$' && n === '$') { state = '$$'; part += '$$'; i++; continue; }
    if (c === "'" || c === '"') { state = c; part += c; continue; }
    if (c === ';') { if (part.trim()) out.push(part.trim()); part = ''; } else part += c;
  }
  if (state && state !== 'line') throw new Error(`Unclosed SQL token: ${state}`);
  if (part.trim()) out.push(part.trim());
  return out;
}

const manifest = readFileSync(resolve(root, 'setup.sql'), 'utf8');
const files = [...manifest.matchAll(/^\s*EXECUTE IMMEDIATE FROM '([^']+)'/gm)].map(m => m[1].replace(/^\.\//, ''));
const skip = new Set(['account/01_cross_region.sql', 'account/02_warehouse.sql', 'account/03_database_schemas.sql',
  'data/load_judge_console_fixtures.sql', 'procedures/judge/judge_probes.sql',
  'search/01_patient_doc_search.sql', 'search/02_reference_doc_search.sql']);
const plan = [], deferredGrants = [], dynamicTables = [];
const add = (file, sql) => plan.push({ step: plan.length + 1, file, sql, hash: createHash('sha256').update(sql).digest('hex').slice(0, 16) });
for (const file of files) {
  if (skip.has(file)) continue;
  if (file === 'data/load_structured_events_copy.sql') {
    for (const facility of ['FAC-01', 'FAC-02', 'FAC-03', 'FAC-04']) {
      const path = resolve(repo, `data/generated/csv/${facility}.csv`);
      readFileSync(path); // fail before connecting if an input is absent
      add('synthetic CSV upload', `PUT 'file://${path}' @SAARTHI.CORE.%STG_SOURCE_EVENTS/${facility}/ AUTO_COMPRESS=TRUE OVERWRITE=FALSE`);
    }
  }
  for (let sql of statements(readFileSync(resolve(root, file), 'utf8'))) {
    if (/^DROP TABLE /i.test(sql)) continue; // legacy probe cleanup is not part of a fresh prototype deploy
    if (/^CREATE ROLE IF NOT EXISTS SAARTHI_JUDGE\b/i.test(sql) || /^GRANT .*\bSAARTHI_JUDGE\b/i.test(sql)) continue;
    if (/^GRANT USAGE ON (?:AGENT|MCP SERVER)\b/i.test(sql)) { deferredGrants.push(sql); continue; }
    if (/^CALL /i.test(sql)) continue; // no execution of AI/orchestrator or automatic readiness on deploy
    if (/^CREATE OR REPLACE DYNAMIC TABLE /i.test(sql)) {
      const name = sql.match(/^CREATE OR REPLACE DYNAMIC TABLE\s+(\S+)/i)[1];
      dynamicTables.push(name);
      sql = sql.replace(/TARGET_LAG\s*=\s*'[^']+'/i, 'TARGET_LAG = DOWNSTREAM');
      add(file, sql);
      add('suspend dynamic table scheduling', `ALTER DYNAMIC TABLE ${name} SUSPEND`);
      continue;
    }
    add(file, sql);
  }
}
for (const sql of deferredGrants) add('deferred agent/MCP grants', sql);
add('application role', 'GRANT ROLE SAARTHI_APP TO USER SITAR');

const apply = process.argv.includes('--apply');
const fromIndex = process.argv.indexOf('--from');
const from = fromIndex < 0 ? 1 : Number(process.argv[fromIndex + 1]);
const untilIndex = process.argv.indexOf('--until');
const until = untilIndex < 0 ? plan.length : Number(process.argv[untilIndex + 1]);
if (!Number.isInteger(from) || !Number.isInteger(until) || from < 1 || until > plan.length || from > until) throw new Error('Invalid bounded step range');
const selected = plan.filter(p => p.step >= from && p.step <= until);
const digest = createHash('sha256').update(JSON.stringify(selected)).digest('hex');
console.log(`Account OHCXVXM-OS69400 / SITAR; SQL-only; steps ${from}-${until}; plan SHA256 ${digest}`);
if (!apply) {
  for (const p of selected) console.log(`${p.step} ${p.hash} ${p.file}: ${p.sql.slice(0, 100).replace(/\s+/g, ' ')}`);
  console.log('DEFERRED: cross-region AI parameter, Cortex Search services, all AI calls, Judge Console. Tasks stay suspended; dynamic tables initialize once then suspend.');
  process.exit(0);
}
const digestIndex = process.argv.indexOf('--sha256');
if (digestIndex < 0 || process.argv[digestIndex + 1] !== digest) throw new Error('Apply requires the exact inspected plan SHA256');
const conn = snowflake.createConnection({ account: 'OHCXVXM-OS69400', username: 'SITAR', role: 'ACCOUNTADMIN',
  authenticator: 'SNOWFLAKE_JWT', privateKey: readFileSync('/Users/aaa/.snowflake/keys/sitar_snow_rsa.p8', 'utf8'),
  clientSessionKeepAlive: false, loginTimeout: 30,
});
let warehouseVerified = false;
let step = 0;
const q = (sqlText) => new Promise((res, rej) => conn.execute({ sqlText,
  complete: (err, stmt, rows) => err ? rej(new Error(`${err.code}: ${err.message}`)) : res({ rows: rows ?? [], id: stmt.getStatementId() }),
}));
const field = (row, key) => row[Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase())];
try {
  await conn.connectAsync();
  const { rows: [who] } = await q('SELECT CURRENT_ACCOUNT() AS LOCATOR, CURRENT_USER() AS LOGIN_USER');
  if (who.LOCATOR !== 'JR18576' || who.LOGIN_USER !== 'SITAR') throw new Error('Unexpected account/user');
  const { rows: [wh] } = await q("SHOW WAREHOUSES LIKE 'SAARTHI_AI_WH'");
  if (!wh || field(wh, 'resource_monitor') !== 'SAARTHI_PROTOTYPE_LIMIT' || String(field(wh, 'size')).toUpperCase() !== 'X-SMALL') throw new Error('Protected X-Small warehouse missing');
  const { rows: [rm] } = await q("SHOW RESOURCE MONITORS LIKE 'SAARTHI_PROTOTYPE_LIMIT'");
  const quota = rm && Number(field(rm, 'credit_quota'));
  const immediate = rm && Number.parseFloat(field(rm, 'suspend_immediately_at'));
  if (!rm || !(quota > 0 && quota <= 2) || !(immediate > 0 && immediate <= 90) || String(field(rm, 'frequency')).toUpperCase() !== 'NEVER') throw new Error('Budget monitor mismatch');
  warehouseVerified = true;
  await q("ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = 120, STATEMENT_QUEUED_TIMEOUT_IN_SECONDS = 30, QUERY_TAG = 'saarthi_prototype_deploy'");
  await q('USE WAREHOUSE SAARTHI_AI_WH');
  await q('USE SECONDARY ROLES NONE');
  const started = Date.now();
  for (const p of selected) {
    step = p.step;
    if (Date.now() - started > 600000) throw new Error('10-minute deployment window exceeded');
    console.log(`RUN ${p.step} ${p.file} ${p.hash}`);
    const result = await q(p.sql);
    console.log(`OK ${p.step} ${result.id}`);
    if (/^PUT /i.test(p.sql) && result.rows.some(r => !['UPLOADED', 'SKIPPED'].includes(String(field(r, 'status'))))) throw new Error('Synthetic CSV upload failed');
  }
  console.log('Selected SQL deployment steps succeeded. AI/Search and frontend E2E remain unverified.');
} catch (err) {
  console.error(`DEPLOY_STOPPED step=${step}: ${err.message}`);
  process.exitCode = 1;
} finally {
  if (warehouseVerified) {
    for (const name of dynamicTables) {
      try { await q(`ALTER DYNAMIC TABLE IF EXISTS ${name} SUSPEND`); } catch { /* may not exist yet */ }
    }
    try { await q('ALTER WAREHOUSE SAARTHI_AI_WH SUSPEND'); console.log('Warehouse suspended.'); }
    catch (err) { console.log(`Warehouse suspension check: ${err.message}`); }
  }
  await new Promise(res => conn.destroy(() => res()));
}
