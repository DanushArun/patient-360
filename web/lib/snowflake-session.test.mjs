import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import * as driverConfig from './snowflake-driver-config.mjs';
import * as apiContracts from './api-contracts.mjs';

const source = ts.transpileModule(readFileSync(new URL('./snowflake.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

function session({ useError, role = 'SAARTHI_APP', secondary = '{"roles":"","value":""}',
  identityError, consentError, destroyError,
  consentResult = { access_scope: 'a'.repeat(64), claims: [], known_as_of: '2026-10-05T00:00:00' }
} = {}) {
  const statements = [];
  let destroyed = 0;
  let checks = 0;
  const conn = {
    connect: cb => cb(null),
    destroy: cb => { destroyed++; cb(destroyError); },
    execute: ({ sqlText, complete }) => {
      statements.push(sqlText);
      const consentIndex = sqlText.includes('VALIDATE_ANSWER') ? checks++ : 0;
      const error = sqlText === 'USE SECONDARY ROLES NONE' ? useError
        : sqlText.includes('CURRENT_SECONDARY_ROLES') ? identityError
        : sqlText.includes('VALIDATE_ANSWER') ? (Array.isArray(consentError) ? consentError[consentIndex] : consentError) : null;
      const rows = sqlText.includes('CURRENT_SECONDARY_ROLES')
        ? [{ APP_ROLE: role, SECONDARY_ROLES: secondary }]
        : sqlText.includes('BIND_PATIENT') ? [{ RESULT: { binding_id: 'fixture-binding' } }]
        : sqlText.includes('VALIDATE_ANSWER') ? [{ RESULT: Array.isArray(consentResult)
          ? consentResult[consentIndex] : consentResult }] : [];
      complete(error, { getStatementId: () => 'synthetic-query' },
        rows);
    },
  };
  const deps = {
    'snowflake-sdk': { configure() {}, createConnection: () => conn },
    './snowflake-driver-config.mjs': driverConfig,
    './api-contracts.mjs': apiContracts,
    fs: { readFileSync: () => 'synthetic-key' },
    './snowflake-config.mjs': { snowflakeConfig: () => ({ account: 'synthetic', username: 'synthetic',
      authenticator: 'SNOWFLAKE_JWT', privateKeyPath: '/synthetic', role: 'SAARTHI_APP' }) },
  };
  const module = { exports: {} };
  new Function('require', 'module', 'exports', source)(specifier => {
    assert.ok(Object.hasOwn(deps, specifier), specifier);
    return deps[specifier];
  }, module, module.exports);
  return { query: module.exports.query, patient: module.exports.withPatientSession,
    statements, destroyed: () => destroyed };
}

test('patient response is withheld when consent is withdrawn during its operation', async () => {
  const s = session({ consentResult: [
    { access_scope: 'a'.repeat(64), claims: [], known_as_of: '2026-10-05T00:00:00' },
    { error: 'access_withdrawn', known_as_of: '2026-10-05T00:00:00' },
  ] });
  await assert.rejects(s.patient('PAT-DC-04', async () => ({ privateRecord: 82000 })),
    /access_withdrawn/);
  assert.equal(s.destroyed(), 1);
  assert.ok(s.statements.at(-1).includes('RELEASE_PATIENT_BINDING'));
});

test('patient response is withheld when final consent verification times out', async () => {
  const s = session({ consentError: [null, new Error('dependency timeout')] });
  await assert.rejects(s.patient('PAT-DC-04', async () => ({ privateRecord: 82000 })),
    /dependency timeout/);
  assert.equal(s.destroyed(), 1);
});

test('patient response is withheld when final scope verification has no source clock', async () => {
  for (const clock of [undefined, '', 'not_received', '2026-99-99T25:99:99']) {
    const s = session({ consentResult: [
      { access_scope: 'a'.repeat(64), claims: [], known_as_of: '2026-10-05T00:00:00' },
      { access_scope: 'a'.repeat(64), claims: [], known_as_of: clock },
    ] });
    await assert.rejects(s.patient('PAT-DC-04', async () => ({ privateRecord: 82000 })),
      /consent_check_unavailable/);
  }
});

test('patient response returns only after fresh consent verification succeeds', async () => {
  const s = session();
  assert.deepEqual(await s.patient('PAT-DC-04', async () => ({ privateRecord: 82000 })),
    { privateRecord: 82000 });
  assert.ok(s.statements.some(sql => sql.includes('VALIDATE_ANSWER')));
  assert.equal(s.destroyed(), 1);
});

test('session cleanup failure is reported instead of returning a successful patient response',
  async () => {
    const s = session({ destroyError: new Error('session close failed') });
    await assert.rejects(s.patient('PAT-DC-04', async () => ({ privateRecord: 82000 })),
      /session close failed/);
  });

test('failure to disable secondary roles closes the session before any application query', async () => {
  const error = Object.assign(new Error('network failed'), { code: 123 });
  const s = session({ useError: error });
  await assert.rejects(s.query('SELECT patient_data'), error);
  assert.equal(s.destroyed(), 1);
  assert.deepEqual(s.statements, ['USE SECONDARY ROLES NONE']);
});

test('restricted session may continue only after SQL confirms app role and no secondary roles', async () => {
  const s = session({ useError: Object.assign(new Error('restricted'), { code: '003107' }) });
  await s.query('SELECT patient_data');
  assert.ok(s.statements.some(sql => sql.includes('CURRENT_SECONDARY_ROLES')));
  assert.equal(s.statements.at(-1), 'SELECT patient_data');
  assert.equal(s.destroyed(), 1);
});

test('unsafe or unverifiable identity never reaches application queries', async () => {
  for (const params of [
    { role: 'ACCOUNTADMIN' },
    { secondary: '{"roles":"ACCOUNTADMIN","value":"ALL"}' },
    { secondary: '{"roles":"","value":"ALL"}' },
    { secondary: null }, { secondary: '{}' }, { secondary: 'invalid-json' },
    { identityError: new Error('identity query failed') },
  ]) {
    const s = session({ ...params, useError: Object.assign(new Error('restricted'), { code: 3107 }) });
    await assert.rejects(s.query('SELECT patient_data'));
    assert.ok(!s.statements.includes('SELECT patient_data'));
    assert.equal(s.destroyed(), 1);
  }
});

test('test_session_when_created_pins_utc_before_application_queries', async () => {
  const s = session();
  await s.query('SELECT patient_data');
  assert.ok(s.statements.slice(0, -1).some(sql => sql.includes("TIMEZONE = 'UTC'")));
});


test('patient response is withheld when consent categories change while reading', async () => {
  const snapshot = { claims: [], known_as_of: '2026-10-05T00:00:00' };
  const s = session({ consentResult: [
    { ...snapshot, access_scope: 'a'.repeat(64) },
    { ...snapshot, access_scope: 'b'.repeat(64) },
  ] });
  await assert.rejects(s.patient('PAT-DC-04', async () => ({ privateRecord: 82000 })),
    /access_scope_changed/);
});

test('patient response is withheld when scope fingerprint is missing', async () => {
  const s = session({ consentResult: { claims: [], known_as_of: '2026-10-05T00:00:00' } });
  await assert.rejects(s.patient('PAT-DC-04', async () => ({ privateRecord: 82000 })),
    /consent_check_unavailable/);
});
