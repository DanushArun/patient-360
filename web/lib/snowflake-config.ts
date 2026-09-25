/** The Snowflake account is deployment configuration, never a source constant. */
export function requireSnowflakeAccount(
  env: Record<string, string | undefined> = process.env,
): string {
  const account = env.SNOWFLAKE_ACCOUNT?.trim();
  if (!account) throw new Error("snowflake_configuration_missing");
  return account;
}
