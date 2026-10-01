/** Explicit per-developer configuration; credentials stay in ignored env files. */
export function snowflakeConfig(env = process.env) {
  // Fail closed before loading a key or constructing a connection. Design work
  // must not resume paid compute just because credentials happen to be present.
  if (env.SAARTHI_SNOWFLAKE_ENABLED !== 'true') {
    throw new Error('snowflake_access_disabled');
  }
  // Temporary compatibility with the legacy direct-table frontend. This is
  // deliberately separate from SNOWFLAKE_ROLE and forbidden outside local dev.
  const recordingAdmin = env.SAARTHI_LOCAL_RECORDING_ADMIN === 'true';
  if (recordingAdmin && env.NODE_ENV !== 'development') {
    throw new Error('snowflake_recording_admin_requires_development');
  }
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
    role: recordingAdmin ? 'ACCOUNTADMIN' : 'SAARTHI_APP',
    warehouse: env.SNOWFLAKE_WAREHOUSE?.trim() || 'SAARTHI_AI_WH',
  };
}
