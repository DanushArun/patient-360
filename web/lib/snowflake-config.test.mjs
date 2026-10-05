import assert from 'node:assert/strict';
import test from 'node:test';
import { snowflakeConfig } from './snowflake-config.mjs';

const identity = { SAARTHI_SNOWFLAKE_ENABLED: 'true',
  SNOWFLAKE_ACCOUNT: 'OHCXVXM-OS69400', SNOWFLAKE_USER: 'synthetic-user',
  SNOWFLAKE_PRIVATE_KEY_PATH: '/tmp/synthetic.p8' };

test('test_configuration_when_not_explicitly_enabled_rejects_live_access', () => {
  for (const enabled of [undefined, '', 'false', 'TRUE', '1', 'yes', ' true ']) {
    assert.throws(() => snowflakeConfig({ ...identity, SAARTHI_SNOWFLAKE_ENABLED: enabled }),
      /snowflake_access_disabled/);
  }
  assert.throws(() => snowflakeConfig({}), /snowflake_access_disabled/);
});

test('test_configuration_when_complete_uses_app_role_and_default_warehouse', () => {
  assert.deepEqual(snowflakeConfig(identity), {
    account: 'OHCXVXM-OS69400', username: 'synthetic-user',
    authenticator: 'SNOWFLAKE_JWT', patPath: undefined,
    privateKeyPath: '/tmp/synthetic.p8', role: 'SAARTHI_APP', warehouse: 'SAARTHI_AI_WH',
  });
});

test('PAT configuration retains the explicit account guard and app role', () => {
  const config = snowflakeConfig({ ...identity, SNOWFLAKE_ACCOUNT: ' ohcxvxm-os69400 ',
    SAARTHI_SNOWFLAKE_ALLOWED_ACCOUNT: ' OHCXVXM-OS69400 ',
    SNOWFLAKE_PAT_PATH: ' /tmp/synthetic.pat ', SNOWFLAKE_ROLE: 'ACCOUNTADMIN' });
  assert.equal(config.account, 'OHCXVXM-OS69400');
  assert.equal(config.authenticator, 'PROGRAMMATIC_ACCESS_TOKEN');
  assert.equal(config.patPath, '/tmp/synthetic.pat');
  assert.equal(config.role, 'SAARTHI_APP');
  assert.throws(() => snowflakeConfig({ ...identity,
    SAARTHI_SNOWFLAKE_ALLOWED_ACCOUNT: 'KGTPGHJ-YJ28449' }), /snowflake_account_mismatch/);
});

test('unsupported authentication and malformed credential paths fail before connecting', () => {
  for (const authenticator of ['OAUTH', 'EXTERNALBROWSER', 'typo', 42]) {
    assert.throws(() => snowflakeConfig({ ...identity, SNOWFLAKE_AUTHENTICATOR: authenticator }),
      /snowflake_configuration_missing/);
  }
  for (const path of [undefined, '', ' ', 42]) {
    assert.throws(() => snowflakeConfig({ ...identity,
      SNOWFLAKE_AUTHENTICATOR: 'PROGRAMMATIC_ACCESS_TOKEN', SNOWFLAKE_PAT_PATH: path }),
      /snowflake_configuration_missing/);
  }
});

test('test_configuration_when_warehouse_supplied_uses_named_warehouse', () => {
  assert.equal(snowflakeConfig({ ...identity, SNOWFLAKE_WAREHOUSE: 'TEST_WH' }).warehouse,
    'TEST_WH');
});

test('test_configuration_when_identity_field_absent_rejects', () => {
  for (const key of ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER', 'SNOWFLAKE_PRIVATE_KEY_PATH']) {
    for (const value of [undefined, '', ' ', 42]) {
      assert.throws(() => snowflakeConfig({ ...identity, [key]: value }),
        /snowflake_configuration_missing/);
    }
  }
});

test('test_configuration_when_role_override_supplied_keeps_app_role', () => {
  assert.equal(snowflakeConfig({ ...identity, SNOWFLAKE_ROLE: 'ACCOUNTADMIN' }).role,
    'SAARTHI_APP');
});

test('test_configuration_when_legacy_admin_flag_set_keeps_app_role', () => {
  for (const nodeEnv of ['development', 'production', 'test', undefined]) {
    assert.equal(snowflakeConfig({ ...identity, NODE_ENV: nodeEnv,
      SAARTHI_LOCAL_RECORDING_ADMIN: 'true' }).role, 'SAARTHI_APP');
  }
});

test('test_configuration_when_account_is_historical_rejects_before_connecting', () => {
  for (const account of ['KGTPGHJ-YJ28449', 'fv11738.me-central2.gcp', 'unknown']) {
    assert.throws(() => snowflakeConfig({ ...identity, SNOWFLAKE_ACCOUNT: account }),
      /snowflake_account_mismatch/);
  }
});

test('test_configuration_when_account_has_case_and_whitespace_normalizes', () => {
  assert.equal(snowflakeConfig({ ...identity,
    SNOWFLAKE_ACCOUNT: ' ohcxvxm-os69400 ' }).account, 'OHCXVXM-OS69400');
});

test('test_configuration_when_hosted_key_supplied_accepts_server_secret', () => {
  const config = snowflakeConfig({ ...identity, SNOWFLAKE_PRIVATE_KEY_PATH: undefined,
    SNOWFLAKE_PRIVATE_KEY: 'synthetic-private-key' });
  assert.equal(config.privateKey, 'synthetic-private-key');
});

test('test_configuration_when_two_key_sources_supplied_rejects_ambiguity', () => {
  assert.throws(() => snowflakeConfig({ ...identity, SNOWFLAKE_PRIVATE_KEY: 'other-key' }),
    /snowflake_configuration_missing/);
});
