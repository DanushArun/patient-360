import assert from 'node:assert/strict';
import test from 'node:test';
import { snowflakeConfig } from './snowflake-config.mjs';

test('live access is opt-in even when complete credentials exist', () => {
  const identity = { SNOWFLAKE_ACCOUNT: 'synthetic-account',
    SNOWFLAKE_USER: 'synthetic-user', SNOWFLAKE_PRIVATE_KEY_PATH: '/tmp/synthetic.p8' };
  for (const enabled of [undefined, '', 'false', 'TRUE', '1', 'yes', ' true ']) {
    assert.throws(() => snowflakeConfig({ ...identity, SAARTHI_SNOWFLAKE_ENABLED: enabled }),
      /snowflake_access_disabled/);
  }
  assert.throws(() => snowflakeConfig({}), /snowflake_access_disabled/);
});

test('connection configuration requires explicit local identity', () => {
  assert.throws(() => snowflakeConfig({ SAARTHI_SNOWFLAKE_ENABLED: 'true' }), /snowflake_configuration_missing/);
  const config = snowflakeConfig({ SAARTHI_SNOWFLAKE_ENABLED: 'true', SNOWFLAKE_ACCOUNT: 'synthetic-account',
    SNOWFLAKE_USER: 'synthetic-user', SNOWFLAKE_PRIVATE_KEY_PATH: '/tmp/synthetic.p8' });
  assert.equal(config.role, 'SAARTHI_APP');
  assert.equal(config.warehouse, 'SAARTHI_AI_WH');
  assert.equal(config.username, 'synthetic-user');
});

test('empty credentials are rejected and warehouse can be configured', () => {
  assert.throws(() => snowflakeConfig({ SAARTHI_SNOWFLAKE_ENABLED: 'true', SNOWFLAKE_ACCOUNT: ' ', SNOWFLAKE_USER: 'x',
    SNOWFLAKE_PRIVATE_KEY_PATH: '/tmp/key' }), /snowflake_configuration_missing/);
  assert.equal(snowflakeConfig({ SAARTHI_SNOWFLAKE_ENABLED: 'true', SNOWFLAKE_ACCOUNT: 'a', SNOWFLAKE_USER: 'u',
    SNOWFLAKE_PRIVATE_KEY_PATH: '/tmp/key', SNOWFLAKE_WAREHOUSE: 'TEST_WH' }).warehouse, 'TEST_WH');
});

test('every identity field is mandatory after enabling live access', () => {
  const identity = { SAARTHI_SNOWFLAKE_ENABLED: 'true', SNOWFLAKE_ACCOUNT: 'synthetic-account',
    SNOWFLAKE_USER: 'synthetic-user', SNOWFLAKE_PRIVATE_KEY_PATH: '/tmp/synthetic.p8' };
  for (const key of ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER', 'SNOWFLAKE_PRIVATE_KEY_PATH']) {
    for (const value of [undefined, '', ' ', 42]) {
      assert.throws(() => snowflakeConfig({ ...identity, [key]: value }), /snowflake_configuration_missing/);
    }
  }
});

test('an environment role cannot elevate the application', () => {
  assert.equal(snowflakeConfig({ SAARTHI_SNOWFLAKE_ENABLED: 'true', SNOWFLAKE_ACCOUNT: 'a',
    SNOWFLAKE_USER: 'u', SNOWFLAKE_PRIVATE_KEY_PATH: '/tmp/key',
    SNOWFLAKE_ROLE: 'ACCOUNTADMIN' }).role, 'SAARTHI_APP');
});

const recordingIdentity = { SAARTHI_SNOWFLAKE_ENABLED: 'true', SNOWFLAKE_ACCOUNT: 'a',
  SNOWFLAKE_USER: 'u', SNOWFLAKE_PRIVATE_KEY_PATH: '/tmp/key' };

test('legacy recording admin requires an explicit opt-in in development', () => {
  assert.equal(snowflakeConfig({ ...recordingIdentity, NODE_ENV: 'development',
    SAARTHI_LOCAL_RECORDING_ADMIN: 'true' }).role, 'ACCOUNTADMIN');
  for (const flag of [undefined, '', 'false', 'TRUE', '1', ' true ']) {
    assert.equal(snowflakeConfig({ ...recordingIdentity, NODE_ENV: 'development',
      SAARTHI_LOCAL_RECORDING_ADMIN: flag }).role, 'SAARTHI_APP');
  }
});

test('recording admin fails closed in production, tests, and unspecified environments', () => {
  for (const nodeEnv of [undefined, '', 'test', 'production']) {
    assert.throws(() => snowflakeConfig({ ...recordingIdentity, NODE_ENV: nodeEnv,
      SAARTHI_LOCAL_RECORDING_ADMIN: 'true' }), /snowflake_recording_admin_requires_development/);
  }
});

test('recording admin cannot bypass the live-access switch or missing credentials', () => {
  assert.throws(() => snowflakeConfig({ ...recordingIdentity, NODE_ENV: 'development',
    SAARTHI_LOCAL_RECORDING_ADMIN: 'true', SAARTHI_SNOWFLAKE_ENABLED: 'false' }), /snowflake_access_disabled/);
  assert.throws(() => snowflakeConfig({ ...recordingIdentity, NODE_ENV: 'development',
    SAARTHI_LOCAL_RECORDING_ADMIN: 'true', SNOWFLAKE_PRIVATE_KEY_PATH: '' }), /snowflake_configuration_missing/);
});
