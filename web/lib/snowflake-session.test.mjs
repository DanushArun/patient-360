import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import * as driverConfig from './snowflake-driver-config.mjs';
import * as apiContracts from './api-contracts.mjs';

const source = ts.transpileModule(readFileSync(new URL('./snowflake.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;

function session({ useError, role = 'SAARTHI_APP', secondary = '{"roles":"","value":""}', identityError } = {}) {
  const statements = [];
  let destroyed = 0;
  const conn = {
    connect: cb => cb(null),
    destroy: cb => { destroyed++; cb(); },
    execute: ({ sqlText, complete }) => {
      statements.push(sqlText);
      const error = sqlText === 'USE SECONDARY ROLES NONE' ? useError
        : sqlText.includes('CURRENT_SECONDARY_ROLES') ? identityError : null;
      complete(error, { getStatementId: () => 'synthetic-query' },
        sqlText.includes('CURRENT_SECONDARY_ROLES') ? [{ APP_ROLE: role, SECONDARY_ROLES: secondary }] : []);
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
  return { query: module.exports.query, statements, destroyed: () => destroyed };
}

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
