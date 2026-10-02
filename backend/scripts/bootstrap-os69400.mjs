#!/usr/bin/env node
// Bounded, account-pinned bootstrap. No AI, DML, warehouse resume, or data upload.
// Uses the existing local key; browser authentication is only for the installer.
import { createRequire } from 'node:module';
import { snowflakeDriverConfig } from '../../web/lib/snowflake-driver-config.mjs';
import { readFileSync } from 'node:fs';
import { createHash, createPublicKey } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const require = createRequire(new URL('../../web/package.json', import.meta.url));
const snowflake = require('snowflake-sdk');
snowflake.configure(snowflakeDriverConfig);
const keyPath = '/Users/aaa/.snowflake/keys/sitar_snow_rsa.p8';
const pubPath = '/Users/aaa/.snowflake/keys/sitar_snow_rsa.pub';
const publicDer = createPublicKey(readFileSync(pubPath)).export({ type: 'spki', format: 'der' });
const privatePublicDer = createPublicKey(readFileSync(keyPath)).export({ type: 'spki', format: 'der' });
if (!publicDer.equals(privatePublicDer)) throw new Error('Local public/private keys do not match');
const fingerprint = `SHA256:${createHash('sha256').update(publicDer).digest('base64')}`;
const monitor = 'SAARTHI_PROTOTYPE_LIMIT';
const account = 'OHCXVXM-OS69400';
const username = 'SITAR';
const apply = process.argv.includes('--apply');
const browser = process.argv.includes('--browser');

if (!apply) {
  console.log(JSON.stringify({ account, username, mode: 'plan', fingerprint,
    actions: ['Verify account locator JR18576 and user SITAR',
      'Register public key only in an empty RSA slot (never replace another key)',
      'Create 2-credit NEVER-reset resource monitor; suspend immediately at 90%',
      'Create initially suspended XSMALL SAARTHI_AI_WH and attach monitor',
      'Set warehouse statement timeout 120s and queue timeout 30s',
      'Create SAARTHI database and its seven project schemas'],
    excludes: ['AI calls', 'Search services', 'tasks', 'data loading', 'warehouse resume', 'Judge Console'],
  }, null, 2));
  process.exit(0);
}

const conn = snowflake.createConnection({ account, username, role: 'ACCOUNTADMIN',
  authenticator: browser ? 'OAUTH_AUTHORIZATION_CODE' : 'SNOWFLAKE_JWT',
  ...(browser ? {} : { privateKey: readFileSync(keyPath, 'utf8') }),
  clientSessionKeepAlive: false, loginTimeout: 90,
});
const query = (sqlText, binds = []) => new Promise((resolve, reject) => conn.execute({
  sqlText, binds, complete: (err, stmt, rows) => {
    if (err) reject(new Error(`${err.code ?? 'SQL'}: ${err.message}`));
    else { console.log(`OK ${stmt.getStatementId()} ${sqlText.split(/\s+/).slice(0, 5).join(' ')}`); resolve(rows ?? []); }
  },
}));
const value = (row, key) => row[Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase())];

try {
  await conn.connectAsync();
  const [identity] = await query('SELECT CURRENT_ACCOUNT() AS LOCATOR, CURRENT_ACCOUNT_NAME() AS ACCOUNT_NAME, CURRENT_USER() AS LOGIN_USER, CURRENT_ROLE() AS ACTIVE_ROLE');
  if (identity.LOCATOR !== 'JR18576' || identity.ACCOUNT_NAME !== 'OS69400' || identity.LOGIN_USER !== username || identity.ACTIVE_ROLE !== 'ACCOUNTADMIN') throw new Error('Unexpected installer identity; no changes made');
  await query("ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS = 120, STATEMENT_QUEUED_TIMEOUT_IN_SECONDS = 30, QUERY_TAG = 'saarthi_bounded_bootstrap'");
  const properties = await query('DESC USER SITAR');
  const property = name => value(properties.find(r => value(r, 'property') === name) ?? {}, 'value');
  const fp1 = property('RSA_PUBLIC_KEY_FP');
  const fp2 = property('RSA_PUBLIC_KEY_2_FP');
  if (fp1 !== fingerprint && fp2 !== fingerprint) {
    const empty = v => v == null || v === '' || v === 'null';
    const slot = empty(fp1) ? 'RSA_PUBLIC_KEY' : empty(fp2) ? 'RSA_PUBLIC_KEY_2' : null;
    if (!slot) throw new Error('Both RSA key slots are occupied; no key replaced');
    await query(`ALTER USER SITAR SET ${slot} = '${publicDer.toString('base64')}'`);
  }
  const existing = await query(`SHOW RESOURCE MONITORS LIKE '${monitor}'`);
  if (existing.length) {
    const quota = Number(value(existing[0], 'credit_quota'));
    const frequency = String(value(existing[0], 'frequency')).toUpperCase();
    const suspend = Number.parseFloat(value(existing[0], 'suspend_immediately_at'));
    if (!(quota > 0 && quota <= 2 && frequency === 'NEVER' && suspend > 0 && suspend <= 90)) throw new Error('Existing monitor requires review; not changed');
  } else {
    await query(`CREATE RESOURCE MONITOR ${monitor} WITH CREDIT_QUOTA = 2 FREQUENCY = NEVER START_TIMESTAMP = IMMEDIATELY TRIGGERS ON 90 PERCENT DO SUSPEND_IMMEDIATE`);
  }
  const warehouses = await query("SHOW WAREHOUSES LIKE 'SAARTHI_AI_WH'");
  if (warehouses.length) throw new Error('SAARTHI_AI_WH already exists; inspect it before continuing; no warehouse changed');
  await query(`CREATE WAREHOUSE SAARTHI_AI_WH WAREHOUSE_SIZE = 'XSMALL' AUTO_SUSPEND = 60 AUTO_RESUME = TRUE INITIALLY_SUSPENDED = TRUE RESOURCE_MONITOR = ${monitor} STATEMENT_TIMEOUT_IN_SECONDS = 120 STATEMENT_QUEUED_TIMEOUT_IN_SECONDS = 30`);
  const ddl = readFileSync(fileURLToPath(new URL('../sql/account/03_database_schemas.sql', import.meta.url)), 'utf8').replace(/^\s*--.*$/gm, '');
  for (const statement of ddl.split(';').map(s => s.trim()).filter(Boolean)) {
    if (!/^CREATE (?:DATABASE|SCHEMA) IF NOT EXISTS SAARTHI\b/i.test(statement)) throw new Error('Unexpected bootstrap DDL');
    await query(statement);
  }
  const [warehouse] = await query("SHOW WAREHOUSES LIKE 'SAARTHI_AI_WH'");
  console.log(JSON.stringify({ status: 'bootstrap_verified', warehouse: value(warehouse, 'name'), state: value(warehouse, 'state'), size: value(warehouse, 'size'), monitor: value(warehouse, 'resource_monitor'), warning: 'Warehouse limit does not cover serverless AI/Search or guarantee a dollar cap.' }));
} catch (err) {
  console.error(`BOOTSTRAP_STOPPED: ${err.message}`);
  process.exitCode = 1;
} finally {
  await new Promise(resolve => conn.destroy(() => resolve()));
}
