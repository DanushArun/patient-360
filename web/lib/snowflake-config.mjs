const DEFAULT_ACCOUNT = 'OHCXVXM-OS69400';

/** @param {Record<string, string | undefined>} env */
export function snowflakeConfig(env = process.env) {
  if (env.SAARTHI_SNOWFLAKE_ENABLED !== 'true') {
    throw new Error('snowflake_access_disabled');
  }
  const required = ['SNOWFLAKE_ACCOUNT', 'SNOWFLAKE_USER'];
  for (const key of required) {
    if (typeof env[key] !== 'string' || !env[key].trim()) {
      throw new Error('snowflake_configuration_missing');
    }
  }
  const account = env.SNOWFLAKE_ACCOUNT.trim().toUpperCase();
  const allowed = typeof env.SAARTHI_SNOWFLAKE_ALLOWED_ACCOUNT === 'string'
    ? env.SAARTHI_SNOWFLAKE_ALLOWED_ACCOUNT.trim().toUpperCase() : undefined;
  // Typo guard, not a security control: the default is the current submission account.
  // A migration sets SAARTHI_SNOWFLAKE_ALLOWED_ACCOUNT; omission never authorizes every account.
  if (account !== (allowed || DEFAULT_ACCOUNT)) {
    throw new Error('snowflake_account_mismatch');
  }
  const patPath = typeof env.SNOWFLAKE_PAT_PATH === 'string' ? env.SNOWFLAKE_PAT_PATH.trim() : undefined;
  const privateKeyPath = typeof env.SNOWFLAKE_PRIVATE_KEY_PATH === 'string' ? env.SNOWFLAKE_PRIVATE_KEY_PATH.trim() : undefined;
  if (env.SNOWFLAKE_AUTHENTICATOR !== undefined && typeof env.SNOWFLAKE_AUTHENTICATOR !== 'string') {
    throw new Error('snowflake_configuration_missing');
  }
  const authenticator = env.SNOWFLAKE_AUTHENTICATOR?.trim().toUpperCase()
    || (patPath ? 'PROGRAMMATIC_ACCESS_TOKEN' : 'SNOWFLAKE_JWT');
  if (authenticator === 'PROGRAMMATIC_ACCESS_TOKEN' && !patPath) {
    throw new Error('snowflake_configuration_missing');
  }
  if (authenticator === 'SNOWFLAKE_JWT' && !privateKeyPath) {
    throw new Error('snowflake_configuration_missing');
  }
  if (!['PROGRAMMATIC_ACCESS_TOKEN', 'SNOWFLAKE_JWT'].includes(authenticator)) {
    throw new Error('snowflake_configuration_missing');
  }
  return {
    account,
    username: env.SNOWFLAKE_USER.trim(),
    authenticator,
    patPath,
    privateKeyPath,
    role: 'SAARTHI_APP',
    warehouse: env.SNOWFLAKE_WAREHOUSE?.trim() || 'SAARTHI_AI_WH',
  };
}
