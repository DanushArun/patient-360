import assert from "node:assert/strict";
import test from "node:test";
import { createPatientGet, parseBasicAuthorization, patientScopeDenied, unauthorized, withBoundPatientSession } from "../lib/session-security.ts";

test("rejects missing, malformed, or incomplete professional credentials", () => {
  assert.equal(parseBasicAuthorization(null), null);
  assert.equal(parseBasicAuthorization("Bearer token"), null);
  assert.equal(parseBasicAuthorization("Basic !!!"), null);
  assert.equal(parseBasicAuthorization(`Basic ${Buffer.from("clinician:").toString("base64")}`), null);
});

test("returns a generic challenge body when no professional login is present", async () => {
  const response = unauthorized();
  assert.equal(response.status, 401);
  assert.match(response.headers.get("www-authenticate") ?? "", /^Basic realm=/);
  assert.deepEqual(await response.json(), { error: "professional_login_required" });
});

test("keeps concurrent patients in separate Snowflake session bindings", async () => {
  const calls = [];
  const makeConnection = (user) => {
    let boundPatient = null;
    return {
      execute: async (sql, binds = []) => {
        calls.push(`${user}:${sql}`);
        if (sql.includes("BIND_PATIENT")) {
          const patientId = String(binds[0]);
          if (patientId === "foreign") {
            return [{ RESULT: JSON.stringify({ error: "no_patient_access" }) }];
          }
          if (patientId === "revoked") {
            return [{ RESULT: JSON.stringify({ error: "consent_not_valid" }) }];
          }
          if (user === "wrong-role") {
            return [{ RESULT: JSON.stringify({ error: "no_patient_access" }) }];
          }
          boundPatient = patientId;
          return [{ RESULT: JSON.stringify({ binding_id: `${user}:${patientId}` }) }];
        }
        if (sql.includes("RELEASE_PATIENT_BINDING")) {
          boundPatient = null;
          return [];
        }
        return [{ PATIENT_ID: boundPatient }];
      },
      destroy: async () => { calls.push(`${user}:destroy`); },
    };
  };

  const run = (user, patient) => withBoundPatientSession(
    makeConnection(user), patient, async (execute) => (await execute("READ_BOUND_PATIENT"))[0]?.PATIENT_ID,
  );
  const [a, b] = await Promise.all([run("doctor-a", "patient-a"), run("doctor-b", "patient-b")]);
  assert.deepEqual([a, b], ["patient-a", "patient-b"]);
  assert.equal(calls.filter((call) => call.endsWith(":destroy")).length, 2);
  await assert.rejects(run("doctor-a", "foreign"), /no_patient_access/);
  await assert.rejects(run("doctor-a", "revoked"), /consent_not_valid/);
  await assert.rejects(run("wrong-role", "patient-a"), /no_patient_access/);
});

test("releases after malformed bind response and awaits connection destruction", async () => {
  const calls = [];
  const connection = {
    execute: async (sql) => {
      calls.push(sql);
      if (sql.includes("BIND_PATIENT")) return [];
      return [];
    },
    destroy: async () => { await new Promise((resolve) => setTimeout(resolve, 5)); calls.push("destroyed"); },
  };
  await assert.rejects(withBoundPatientSession(connection, "patient-a", async () => "unreachable"), /binding_unavailable/);
  assert.ok(calls.some((sql) => sql.includes("RELEASE_PATIENT_BINDING")));
  assert.equal(calls.at(-1), "destroyed");
});

test("releases and closes after a request fails after a successful bind", async () => {
  const calls = [];
  const connection = {
    execute: async (sql) => {
      calls.push(sql);
      if (sql.includes("BIND_PATIENT")) return [{ RESULT: JSON.stringify({ binding_id: "synthetic-binding" }) }];
      return [];
    },
    destroy: async () => { calls.push("destroyed"); },
  };
  await assert.rejects(withBoundPatientSession(connection, "patient-a", async () => {
    throw new Error("synthetic_read_failure");
  }), /synthetic_read_failure/);
  assert.ok(calls.some((sql) => sql.includes("RELEASE_PATIENT_BINDING")));
  assert.equal(calls.at(-1), "destroyed");
});

test("patient HTTP handlers hide scope details for foreign, revoked, and wrong-role requests", async () => {
  const handler = createPatientGet(async (patientId, login) => {
    if (login.username === "wrong-role") throw new Error("no_patient_access");
    if (patientId === "foreign") throw new Error("no_patient_access");
    if (patientId === "revoked") throw new Error("consent_not_valid");
    return { patientId, patientName: "Synthetic Patient", gates: [{ outcome: "pass" }] };
  }, "patient_unavailable");
  const request = (user, id) => new Request(`http://localhost/api/patient/${id}`, {
    headers: { authorization: `Basic ${Buffer.from(`${user}:synthetic-password`).toString("base64")}` },
  });
  for (const [user, id] of [["clinician", "foreign"], ["clinician", "revoked"], ["wrong-role", "patient-a"]]) {
    const response = await handler(request(user, id), { params: Promise.resolve({ id }) });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { error: "patient_scope_denied" });
  }
});

test("patient HTTP handlers keep authorized data isolated during concurrent A/B requests", async () => {
  const handler = createPatientGet(async (patientId) => ({ patientId, facts: [`fact-for-${patientId}`] }), "patient_unavailable");
  const request = (id) => new Request(`http://localhost/api/patient/${id}`, {
    headers: { authorization: `Basic ${Buffer.from(`clinician-${id}:synthetic-password`).toString("base64")}` },
  });
  const [responseA, responseB] = await Promise.all([
    handler(request("patient-a"), { params: Promise.resolve({ id: "patient-a" }) }),
    handler(request("patient-b"), { params: Promise.resolve({ id: "patient-b" }) }),
  ]);
  const [bodyA, bodyB] = await Promise.all([responseA.json(), responseB.json()]);
  assert.deepEqual(bodyA, { patientId: "patient-a", facts: ["fact-for-patient-a"] });
  assert.deepEqual(bodyB, { patientId: "patient-b", facts: ["fact-for-patient-b"] });
  assert.equal(JSON.stringify(bodyA).includes("patient-b"), false);
  assert.equal(JSON.stringify(bodyB).includes("patient-a"), false);
});

test("patient scope denials share a generic no-store response across endpoints", async () => {
  for (const code of ["no_patient_access", "consent_not_valid", "patient_scope_denied"]) {
    const response = patientScopeDenied(new Error(code));
    assert.equal(response?.status, 403);
    assert.equal(response?.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response?.json(), { error: "patient_scope_denied" });
  }
  assert.equal(patientScopeDenied(new Error("database_unavailable")), null);
});
