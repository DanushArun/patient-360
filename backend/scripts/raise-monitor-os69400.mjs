#!/usr/bin/env node
// One-account, one-property migration. Metadata only until the guarded ALTER.
// Does not select/resume a warehouse, run Cortex, or change monitor triggers.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { checkApproval, field } from '../extraction/live_trial_core.mjs';
import { snowflakeDriverConfig } from '../../web/lib/snowflake-driver-config.mjs';

if (process.argv.length !== 4 || process.argv[2] !== '--approved-raise-to-3') {
  throw new Error('Usage: node --use-system-ca backend/scripts/raise-monitor-os69400.mjs --approved-raise-to-3 /absolute/path/to/local-trial-approval.json');
}
// A fresh, human-observed balance and prior-spend estimate are mandatory. The
// command does not read billing history or silently extend the $10 approval.
const approval = checkApproval(JSON.parse(readFileSync(process.argv[3], 'utf8')));
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const sf = require('snowflake-sdk');
sf.configure(snowflakeDriverConfig);
const connection = sf.createConnection({
  account: 'OHCXVXM-OS69400', username: 'SITAR', role: 'ACCOUNTADMIN',
  authenticator: 'SNOWFLAKE_JWT',
  privateKey: readFileSync(process.env.SNOWFLAKE_PRIVATE_KEY_PATH ||
    join(homedir(), '.snowflake', 'keys', 'sitar_snow_rsa.p8'), 'utf8'),
  loginTimeout: 15, timeout: 15000, clientSessionKeepAlive: false,
});
let deadline = setTimeout(() => {
  process.stderr.write('MONITOR_CHANGE_STOPPED connection_deadline\n');
  process.exit(1);
}, 45000);
const query = sqlText => new Promise((resolve, reject) => connection.execute({
  sqlText, complete(error, statement, rows) {
    if (statement?.getStatementId()) process.stdout.write('QUERY_ID ' + statement.getStatementId() + '\n');
    if (error) reject(new Error('sql_' + String(error.code ?? 'failed')));
    else resolve(rows ?? []);
  },
}));
const stop = code => { throw new Error(code); };

try {
  await connection.connectAsync();
  await query('USE SECONDARY ROLES NONE');
  await query("ALTER SESSION SET STATEMENT_TIMEOUT_IN_SECONDS=5, STATEMENT_QUEUED_TIMEOUT_IN_SECONDS=5, QUERY_TAG='saarthi_raise_monitor_three'");
  const [who] = await query('SELECT CURRENT_ACCOUNT() AS A, CURRENT_USER() AS U, CURRENT_REGION() AS R, CURRENT_ROLE() AS ROLE');
  if (who?.A !== 'JR18576' || who?.U !== 'SITAR' || who?.R !== 'GCP_ME_CENTRAL2' || who?.ROLE !== 'ACCOUNTADMIN') stop('unexpected_account_or_role');
  const warehouses = await query('SHOW WAREHOUSES');
  const assigned = warehouses.filter(row => field(row, 'resource_monitor') === 'SAARTHI_PROTOTYPE_LIMIT');
  if (assigned.length !== 1 || field(assigned[0], 'name') !== 'SAARTHI_AI_WH' ||
      field(assigned[0], 'state') !== 'SUSPENDED' || field(assigned[0], 'size') !== 'X-Small' ||
      Number(field(assigned[0], 'auto_suspend')) !== 60) stop('warehouse_scope_or_state_changed');
  const [before] = await query("SHOW RESOURCE MONITORS LIKE 'SAARTHI_PROTOTYPE_LIMIT'");
  const quota = Number(field(before, 'credit_quota'));
  const usedRaw = field(before, 'used_credits');
  const used = Number(usedRaw);
  if (!before || ![2, 3].includes(quota) || field(before, 'level') !== 'WAREHOUSE' ||
      String(field(before, 'frequency')).toUpperCase() !== 'NEVER' ||
      Number.parseFloat(field(before, 'suspend_immediately_at')) !== 90 ||
      usedRaw == null || !Number.isFinite(used) || used < 0 || used >= 2.0) stop('monitor_state_or_reserve_changed');
  // The extra one-credit quota represents up to $6.50 of warehouse usage at
  // the published GCP Dammam Business Critical on-demand list rate. Reserve
  // that full amount inside the user's $10 continued-work approval.
  if (quota === 2 && (approval.availableFundsUsd < 6.5 ||
      approval.priorTrialSpendUsd + 6.5 > approval.approvedBudgetUsd)) stop('monitor_extension_outside_approved_budget');
  process.stdout.write(JSON.stringify({account:'OHCXVXM-OS69400',monitor:'SAARTHI_PROTOTYPE_LIMIT',
    currentQuotaCredits:quota,reportedUsedCredits:used,targetQuotaCredits:3,
    approvalUsd:approval.approvedBudgetUsd,priorTrialSpendUsd:approval.priorTrialSpendUsd,
    note:'Monitor covers warehouse credits only; reported usage can lag.'}) + '\n');
  if (quota === 2) await query('ALTER RESOURCE MONITOR SAARTHI_PROTOTYPE_LIMIT SET CREDIT_QUOTA = 3');
  const [after] = await query("SHOW RESOURCE MONITORS LIKE 'SAARTHI_PROTOTYPE_LIMIT'");
  if (Number(field(after, 'credit_quota')) !== 3 ||
      Number.parseFloat(field(after, 'suspend_immediately_at')) !== 90 ||
      String(field(after, 'frequency')).toUpperCase() !== 'NEVER' ||
      field(after, 'level') !== 'WAREHOUSE') stop('monitor_postcondition_unverified');
  process.stdout.write(JSON.stringify({status: quota === 2 ? 'updated_and_verified' : 'already_three_verified',
    quotaCredits:3,reportedUsedCredits:field(after, 'used_credits'),
    immediateSuspendPercent:90,warehouse:'SAARTHI_AI_WH'}) + '\n');
} catch (error) {
  process.stderr.write('MONITOR_CHANGE_STOPPED ' + (/^[a-z0-9_]+$/.test(error.message) ? error.message : 'connection_or_metadata_error') + '\n');
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  await new Promise(resolve => connection.destroy(() => resolve()));
}
