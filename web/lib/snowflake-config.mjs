/** Explicit per-developer configuration; credentials stay in ignored env files. */
export function snowflakeConfig(env = process.env) {
  const required = ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER', 'SNOWFLAKE_PRIVATE_KEY_PATH'];
  for (const key of required) {
    if (typeof env[key] !== 'string' || !env[key].trim()) {
      throw new Error('snowflake_configuration_missing');
    }
  }
  return {
    account: env.SNOWFLAKE_ACCOUNT.trim(),
    username: env.SNOWFLAKE_USER.trim(),
    privateKeyPath: env.SNOWFLAKE_PRIVATE_KEY_PATH.trim(),
    role: 'SAARTHI_APP',
    warehouse: env.SNOWFLAKE_WAREHOUSE?.trim() || 'SAARTHI_AI_WH',
  };
}
