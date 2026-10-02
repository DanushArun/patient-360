#!/usr/bin/env node
// Bounded deterministic verification; no Cortex model or Search calls.
import { createRequire } from 'node:module';
import { snowflakeDriverConfig } from '../../web/lib/snowflake-driver-config.mjs';
import { readFileSync } from 'node:fs';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const snowflake = require('snowflake-sdk');
snowflake.configure(snowflakeDriverConfig);
const conn = snowflake.createConnection({ account: 'OHCXVXM-OS69400', username: 'SITAR',
  role: 'ACCOUNTADMIN', authenticator: 'SNOWFLAKE_JWT',
  privateKey: readFileSync('/Users/aaa/.snowflake/keys/sitar_snow_rsa.p8', 'utf8'), loginTimeout: 30,
});
const q = sqlText => new Promise((res, rej) => conn.execute({ sqlText, complete: (err, stmt, rows) => {
  if (err) rej(new Error(`${err.code}: ${err.message}`));
  else { console.log(`QUERY ${stmt.getStatementId()} ${sqlText.slice(0, 100)}`); res(rows ?? []); }
}}));
const field = (row, key) => row[Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase())];
const cell = rows => { const v = Object.values(rows[0] ?? {})[0]; return typeof v === 'string' ? JSON.parse(v) : v; };
let safe = false;
try {
  await conn.connectAsync();
  const [who] = await q('SELECT CURRENT_ACCOUNT() AS LOCATOR, CURRENT_USER() AS LOGIN_USER');
  if (who.LOCATOR !== 'JR18576' || who.LOGIN_USER !== 'SITAR') throw new Error('Unexpected identity');
  const [wh] = await q("SHOW WAREHOUSES LIKE 'SAARTHI_AI_WH'");
  if (field(wh, 'resource_monitor') !== 'SAARTHI_PROTOTYPE_LIMIT') throw new Error('Monitor missing');
  safe = true;
  await q("ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS=120, STATEMENT_QUEUED_TIMEOUT_IN_SECONDS=30, QUERY_TAG='saarthi_sql_smoke'");
  await q('USE SECONDARY ROLES NONE');
  await q('USE WAREHOUSE SAARTHI_AI_WH');
  console.log('COUNTS', JSON.stringify(await q('SELECT (SELECT COUNT(*) FROM SAARTHI.CORE.PATIENT) AS PATIENTS, (SELECT COUNT(*) FROM SAARTHI.OPERATIONAL.RULE_CATALOG) AS RULES, (SELECT COUNT(*) FROM SAARTHI.CORE.CLINICAL_EVENT) AS EVENTS')));
  const tasks = await q('SHOW TASKS IN DATABASE SAARTHI');
  console.log('TASKS', JSON.stringify(tasks.map(r => ({ name: field(r, 'name'), state: field(r, 'state') }))));
  if (tasks.some(r => String(field(r, 'state')).toUpperCase() !== 'SUSPENDED')) throw new Error('Unexpected running task');
  const search = await q('SHOW CORTEX SEARCH SERVICES IN DATABASE SAARTHI');
  if (search.length) throw new Error('Unexpected Search services; inspect their billing state');
  await q('USE ROLE SAARTHI_APP');
  console.log('APP_IDENTITY', JSON.stringify(await q('SELECT CURRENT_ROLE(), CURRENT_SECONDARY_ROLES(), CURRENT_USER()')));
  let denied = false;
  try { await q('SELECT COUNT(*) FROM SAARTHI.CORE.PATIENT'); }
  catch (err) { if (/002003|003001|does not exist or not authorized|Insufficient privileges/i.test(err.message)) denied = true; else throw err; }
  if (!denied) throw new Error('Unexpected direct patient-table access');
  console.log('PASS application role has no direct patient-table access');
  const bind = cell(await q("CALL SAARTHI.OPERATIONAL.BIND_PATIENT('PAT-DC-07')"));
  if (!bind?.binding_id || bind.error) throw new Error(`Binding failed: ${JSON.stringify(bind)}`);
  console.log('PASS authorized patient binding');
  const readiness = cell(await q('CALL SAARTHI.OPERATIONAL.GET_READINESS(NULL,NULL)'));
  if (readiness?.error || !Array.isArray(readiness?.gates) || !readiness.gates.length) throw new Error(`Readiness failed: ${JSON.stringify(readiness)}`);
  console.log('PASS SQL readiness', JSON.stringify({ rules: readiness.gates.length, known_as_of: readiness.known_as_of }));
  const timeline = cell(await q('CALL SAARTHI.OPERATIONAL.GET_TIMELINE(NULL)'));
  if (!timeline || timeline.error) throw new Error(`Timeline failed: ${JSON.stringify(timeline)}`);
  console.log('PASS timeline procedure');
  const mismatch = cell(await q("CALL SAARTHI.OPERATIONAL.GET_READINESS('ENC-DC-01',NULL)"));
  if (mismatch?.error !== 'binding_mismatch') throw new Error('Cross-patient encounter was not rejected');
  console.log('PASS cross-patient encounter rejected');
  await q('CALL SAARTHI.OPERATIONAL.RELEASE_PATIENT_BINDING()');
  const unbound = cell(await q('CALL SAARTHI.OPERATIONAL.GET_READINESS(NULL,NULL)'));
  if (unbound?.error !== 'no_patient_bound') throw new Error('Unbound read was not rejected');
  console.log('PASS unbound read rejected');
  console.log('SQL_SMOKE_PASSED; not a frontend/AI E2E claim');
} catch (err) { console.error(`SMOKE_STOPPED: ${err.message}`); process.exitCode = 1; }
finally {
  if (safe) {
    try { await q('CALL SAARTHI.OPERATIONAL.RELEASE_PATIENT_BINDING()'); } catch {}
    try {
      await q('USE ROLE ACCOUNTADMIN');
      try { await q('ALTER WAREHOUSE SAARTHI_AI_WH SUSPEND'); } catch {}
      const [wh] = await q("SHOW WAREHOUSES LIKE 'SAARTHI_AI_WH'");
      console.log('FINAL_WAREHOUSE', JSON.stringify({ state: field(wh, 'state'), size: field(wh, 'size'), monitor: field(wh, 'resource_monitor') }));
      const [rm] = await q("SHOW RESOURCE MONITORS LIKE 'SAARTHI_PROTOTYPE_LIMIT'");
      console.log('MONITOR', JSON.stringify({ quota: field(rm, 'credit_quota'), used: field(rm, 'used_credits'), frequency: field(rm, 'frequency'), immediate_suspend: field(rm, 'suspend_immediately_at'), warning: 'Reported usage may lag; excludes serverless AI/Search.' }));
    } catch (err) { console.error(`CLEANUP_CHECK_FAILED: ${err.message}`); process.exitCode = 1; }
  }
  await new Promise(res => conn.destroy(() => res()));
}
