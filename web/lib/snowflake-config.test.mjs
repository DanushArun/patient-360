import assert from 'node:assert/strict';
import test from 'node:test';
import { snowflakeConfig } from './snowflake-config.mjs';

const identity = { SAARTHI_SNOWFLAKE_ENABLED: 'true',
  SNOWFLAKE_ACCOUNT: 'KGTPGHJ-YJ28449', SNOWFLAKE_USER: 'synthetic-user',
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
    account: 'KGTPGHJ-YJ28449', username: 'synthetic-user',
    privateKeyPath: '/tmp/synthetic.p8', role: 'SAARTHI_APP', warehouse: 'SAARTHI_AI_WH',
  });
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
  for (const account of ['OHCXVXM-OS69400', 'fv11738.me-central2.gcp', 'unknown']) {
    assert.throws(() => snowflakeConfig({ ...identity, SNOWFLAKE_ACCOUNT: account }),
      /snowflake_account_mismatch/);
  }
});

test('test_configuration_when_account_has_case_and_whitespace_normalizes', () => {
  assert.equal(snowflakeConfig({ ...identity,
    SNOWFLAKE_ACCOUNT: ' kgtpghj-yj28449 ' }).account, 'KGTPGHJ-YJ28449');
});
