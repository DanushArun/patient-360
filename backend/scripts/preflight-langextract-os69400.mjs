#!/usr/bin/env node
// Metadata preflight for the separately approved, maximum-$1 trial.
// A separate explicit flag applies the approved default-role change only.
// No warehouse selection/resume, patient reads, inference, grants or deployment.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { snowflakeDriverConfig } from '../../web/lib/snowflake-driver-config.mjs';

const setDefaultRole = process.argv[2] === '--approved-set-app-default';
if (process.argv[2] !== '--approved-metadata-check' && !setDefaultRole) {
  throw new Error('Explicit approval flag required; does not authorise inference');
}
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const sf = require('snowflake-sdk');
sf.configure(snowflakeDriverConfig);
const connection = sf.createConnection({
  account: 'OHCXVXM-OS69400', username: 'SITAR', role: 'ACCOUNTADMIN',
  authenticator: 'SNOWFLAKE_JWT',
  privateKey: readFileSync(process.env.SNOWFLAKE_PRIVATE_KEY_PATH ||
    join(homedir(), '.snowflake', 'keys', 'sitar_snow_rsa.p8'), 'utf8'),
  loginTimeout: 20, timeout: 20000, clientSessionKeepAlive: false,
});
const field = (row, name) => row?.[Object.keys(row).find(k => k.toLowerCase() === name.toLowerCase())];
const query = sqlText => new Promise((resolve, reject) => connection.execute({
  sqlText, complete(error, statement, rows) {
    if (error) return reject(new Error(String(error.code ?? 'connection_error')));
    console.log('QUERY_ID', statement.getStatementId());
    resolve(rows ?? []);
  },
}));
// The SDK may retry OCSP/network failures beyond loginTimeout. This standalone
// metadata-only process has no warehouse or patient binding to clean up.
const deadline = setTimeout(() => {
  console.error('PREFLIGHT_STOPPED wall_clock_limit');
  process.exit(1);
}, 45000);

try {
  await connection.connectAsync();
  await query('USE SECONDARY ROLES NONE');
  await query("ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS=15, STATEMENT_QUEUED_TIMEOUT_IN_SECONDS=5, QUERY_TAG='saarthi_langextract_preflight'");
  const [identity] = await query('SELECT CURRENT_ACCOUNT() AS A, CURRENT_USER() AS U');
  if (identity?.A !== 'JR18576' || identity?.U !== 'SITAR') throw new Error('unexpected_identity');
  if (setDefaultRole) {
    // Explicit user approval required. Verify the role is already usable;
    // never add grants or remove the user's existing administrative roles.
    await query('USE ROLE SAARTHI_APP');
    await query('USE ROLE ACCOUNTADMIN');
    await query('ALTER USER SITAR SET DEFAULT_ROLE = SAARTHI_APP');
    console.log('DEFAULT_ROLE_UPDATED SAARTHI_APP');
  }
  const details = await query('DESCRIBE USER SITAR');
  const defaultRole = field(details.find(r => field(r, 'property') === 'DEFAULT_ROLE'), 'value');
  const [warehouse] = await query("SHOW WAREHOUSES LIKE 'SAARTHI_AI_WH'");
  const [monitor] = await query("SHOW RESOURCE MONITORS LIKE 'SAARTHI_PROTOTYPE_LIMIT'");
  const [routing] = await query("SHOW PARAMETERS LIKE 'CORTEX_ENABLED_CROSS_REGION' IN ACCOUNT");
  console.log(JSON.stringify({
    account: 'OHCXVXM-OS69400', user: 'SITAR', defaultRole,
    crossRegion: field(routing, 'value'),
    warehouse: { state: field(warehouse, 'state'), size: field(warehouse, 'size'),
      autoSuspend: field(warehouse, 'auto_suspend'), monitor: field(warehouse, 'resource_monitor') },
    monitor: { quota: field(monitor, 'credit_quota'), used: field(monitor, 'used_credits'),
      immediateSuspend: field(monitor, 'suspend_immediately_at') },
    inferenceCalls: 0, sourcePagesRead: 0,
  }, null, 2));
  const blockers = [];
  if (defaultRole !== 'SAARTHI_APP') blockers.push('rest_default_role_not_restricted_app_role');
  if (field(warehouse, 'size') !== 'X-Small' || field(warehouse, 'resource_monitor') !== 'SAARTHI_PROTOTYPE_LIMIT') blockers.push('warehouse_protection_mismatch');
  if (!monitor || !Number.isFinite(Number(field(monitor, 'used_credits'))) || Number(field(monitor, 'used_credits')) >= 1.5) blockers.push('warehouse_reserve_unconfirmed');
  if (blockers.length) {
    console.log('STOP_BEFORE_INFERENCE', JSON.stringify(blockers));
    process.exitCode = 1;
  } else console.log('METADATA_CHECK_PASSED; live authorisation and dollar-bound checks still required');
} catch (error) {
  // SDK errors can include connection details; emit only a sanitised code.
  console.error('PREFLIGHT_STOPPED', /^[a-zA-Z0-9_]+$/.test(error.message) ? error.message : 'connection_or_metadata_error');
  process.exitCode = 1;
} finally {
  await new Promise(resolve => connection.destroy(() => resolve()));
  clearTimeout(deadline);
}
