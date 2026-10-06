import assert from "node:assert/strict";
import test from "node:test";
import { snowflakeDriverConfig } from "./snowflake-driver-config.mjs";

test("test_driver_when_upgraded_preserves_revocation_checks_and_fails_closed", () => {
  assert.deepEqual(snowflakeDriverConfig, {
    logLevel: "ERROR", disableOCSPChecks: false, ocspFailOpen: false,
  });
});
