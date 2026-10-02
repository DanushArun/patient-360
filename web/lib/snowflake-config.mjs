/** @param {Record<string, string | undefined>} env
 * @returns {{account: string, username: string, privateKeyPath: string,
 * role: string, warehouse: string}} */
export function snowflakeConfig(env = process.env) {
  // Fail closed before loading a key or constructing a connection. Design work
  // must not resume paid compute just because credentials happen to be present.
  if (env.SAARTHI_SNOWFLAKE_ENABLED !== 'true') {
    throw new Error('snowflake_access_disabled');
  }
  const required = ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER', 'SNOWFLAKE_PRIVATE_KEY_PATH'];
  for (const key of required) {
    if (typeof env[key] !== 'string' || !env[key].trim()) {
      throw new Error('snowflake_configuration_missing');
    }
  }
  const account = env.SNOWFLAKE_ACCOUNT.trim().toUpperCase();
  if (account !== 'KGTPGHJ-YJ28449') throw new Error('snowflake_account_mismatch');
  return {
    account,
    username: env.SNOWFLAKE_USER.trim(),
    privateKeyPath: env.SNOWFLAKE_PRIVATE_KEY_PATH.trim(),
    role: 'SAARTHI_APP',
    warehouse: env.SNOWFLAKE_WAREHOUSE?.trim() || 'SAARTHI_AI_WH',
  };
}
