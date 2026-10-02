import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

import * as apiContracts from "./api-contracts.mjs";

const routeSource = readFileSync(
  new URL("../app/api/patient/[id]/route.ts", import.meta.url),
  "utf8",
);
const routeJavaScript = ts.transpileModule(routeSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function loadRoute(patientLoaders) {
  const module = { exports: {} };
  const injectedRequire = (specifier) => {
    if (specifier === "@/lib/patient") return patientLoaders;
    if (specifier === "@/lib/api-contracts.mjs") return apiContracts;
    throw new Error(`Unexpected route dependency: ${specifier}`);
  };
  new Function("require", "module", "exports", routeJavaScript)(
    injectedRequire,
    module,
    module.exports,
  );
  return module.exports;
}

test("test_GET_snapshot_when_read_then_version_is_unchanged_and_POST_refreshes", async () => {
  let storedVersion = 1;
  const route = loadRoute({
    loadPatient: async () => ({ version: ++storedVersion }),
    loadPatientSnapshot: async () => ({ version: storedVersion }),
    refreshPatient: async () => ({ version: ++storedVersion }),
  });
  const context = { params: Promise.resolve({ id: "PAT-1" }) };

  const getResponse = await route.GET(
    new Request("http://localhost/api/patient/PAT-1"), context,
  );
  assert.equal((await getResponse.json()).version, 1);
  assert.equal(storedVersion, 1);

  const postResponse = await route.POST(new Request(
    "http://localhost/api/patient/PAT-1",
    { method: "POST", headers: { origin: "http://localhost", host: "localhost" } },
  ), context);
  assert.equal((await postResponse.json()).version, 2);
  assert.equal(storedVersion, 2);
});
