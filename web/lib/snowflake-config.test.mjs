import assert from 'node:assert/strict';
import test from 'node:test';
import { snowflakeConfig } from './snowflake-config.mjs';

test('connection configuration requires explicit local identity', () => {
  assert.throws(() => snowflakeConfig({}), /snowflake_configuration_missing/);
  const config = snowflakeConfig({ SNOWFLAKE_ACCOUNT: 'synthetic-account',
    SNOWFLAKE_USER: 'synthetic-user', SNOWFLAKE_PRIVATE_KEY_PATH: '/tmp/synthetic.p8' });
  assert.equal(config.role, 'SAARTHI_APP');
  assert.equal(config.warehouse, 'SAARTHI_AI_WH');
  assert.equal(config.username, 'synthetic-user');
});

test('empty credentials are rejected and warehouse can be configured', () => {
  assert.throws(() => snowflakeConfig({ SNOWFLAKE_ACCOUNT: ' ', SNOWFLAKE_USER: 'x',
    SNOWFLAKE_PRIVATE_KEY_PATH: '/tmp/key' }), /snowflake_configuration_missing/);
  assert.equal(snowflakeConfig({ SNOWFLAKE_ACCOUNT: 'a', SNOWFLAKE_USER: 'u',
    SNOWFLAKE_PRIVATE_KEY_PATH: '/tmp/key', SNOWFLAKE_WAREHOUSE: 'TEST_WH' }).warehouse, 'TEST_WH');
});
