import test from "node:test";
import assert from "node:assert/strict";
import { requireSnowflakeAccount } from "../lib/snowflake-config.ts";

test("Snowflake account comes from deployment configuration", () => {
  assert.equal(requireSnowflakeAccount({ SNOWFLAKE_ACCOUNT: " org-account " }), "org-account");
});

test("missing Snowflake account fails closed with a safe error code", () => {
  assert.throws(() => requireSnowflakeAccount({}), { message: "snowflake_configuration_missing" });
});
