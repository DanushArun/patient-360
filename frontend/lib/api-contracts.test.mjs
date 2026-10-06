import assert from "node:assert/strict";
import test from "node:test";
import {
  apiError,
  apiErrorStatus,
  isSameOrigin,
  readJsonBody,
  validateAskBody,
  contextPreamble,
  validateReviewTaskBody,
  validateWorkspaceQuery,
} from "./api-contracts.mjs";

test("test_ask_body_is_bounded_and_trimmed", () => {
  assert.deepEqual(validateAskBody({ patientId: "PAT-DC-07", question: "  What is missing?  " }), {
    patientId: "PAT-DC-07",
    question: "What is missing?",
    sourceScope: "patient",
  });
  assert.equal(validateAskBody({ patientId: "PAT-1", question: "x".repeat(4001) }), null);
});

test("test_ask_body_accepts_only_explicit_patient_or_reference_scope", () => {
  assert.deepEqual(validateAskBody({
    patientId: "PAT-DC-07", question: " policy ", sourceScope: "reference",
  }), { patientId: "PAT-DC-07", question: "policy", sourceScope: "reference" });
  assert.equal(validateAskBody({
    patientId: "PAT-DC-07", question: "policy", sourceScope: "mixed",
  }), null);
});

test("test_workspace_query_accepts_only_known_domains_and_bounded_selectors", () => {
  assert.deepEqual(validateWorkspaceQuery(new URLSearchParams("view=facts&domain=labs")), {
    view: "facts", domain: "labs", knownAsOf: null, documentId: null,
  });
  assert.deepEqual(validateWorkspaceQuery(new URLSearchParams(
    "view=documents&documentId=DOC-1&known_as_of=2026-10-02T08%3A00%3A00",
  )), {
    view: "documents", domain: null, knownAsOf: "2026-10-02T08:00:00", documentId: "DOC-1",
  });
  assert.equal(validateWorkspaceQuery(new URLSearchParams("view=facts&domain=arbitrary")), null);
  assert.deepEqual(validateWorkspaceQuery(new URLSearchParams(
    "view=coverage_comparison&known_as_of=2026-10-02T08%3A00%3A00",
  )), {
    view: "coverage_comparison", domain: null, knownAsOf: "2026-10-02T08:00:00", documentId: null,
  });
  assert.equal(validateWorkspaceQuery(new URLSearchParams(
    "view=coverage_comparison&domain=labs",
  )), null);
  assert.equal(validateWorkspaceQuery(new URLSearchParams(
    "view=documents&documentId=bad%2Fid",
  )), null);
});

test("test_review_task_body_accepts_only_bounded_supported_actions", () => {
  assert.deepEqual(validateReviewTaskBody({
    patientId: "PAT-DC-07", ruleId: "CLIN-PLT-001", action: "escalate",
  }), { patientId: "PAT-DC-07", ruleId: "CLIN-PLT-001", action: "escalate" });
  assert.equal(validateReviewTaskBody({
    patientId: "PAT-DC-07", ruleId: "CLIN-PLT-001", action: "delete",
  }), null);
});

test("test_write_request_requires_exact_same_origin_header", () => {
  const same = new Request("http://localhost:3000/api/ask", { method: "POST", headers: {
    Origin: "http://localhost:3000",
  } });
  const missing = new Request("http://localhost:3000/api/ask", { method: "POST" });
  const foreign = new Request("http://localhost:3000/api/ask", { method: "POST", headers: {
    Origin: "http://evil.example",
  } });

  assert.equal(isSameOrigin(same), true);
  assert.equal(isSameOrigin(missing), false);
  assert.equal(isSameOrigin(foreign), false);
});

test("test_same_origin_uses_validated_host_when_request_url_is_canonicalized", () => {
  const browserHost = new Request("http://localhost:3000/api/ask", { method: "POST", headers: {
    Host: "127.0.0.1:3000",
    Origin: "http://127.0.0.1:3000",
    "X-Forwarded-Host": "evil.example",
  } });
  const foreign = new Request("http://localhost:3000/api/ask", { method: "POST", headers: {
    Host: "127.0.0.1:3000",
    Origin: "http://evil.example",
    "X-Forwarded-Host": "127.0.0.1:3000",
  } });
  const pathOrigin = new Request("http://localhost:3000/api/ask", { method: "POST", headers: {
    Host: "127.0.0.1:3000", Origin: "http://127.0.0.1:3000/path",
  } });

  assert.equal(isSameOrigin(browserHost), true);
  assert.equal(isSameOrigin(foreign), false);
  assert.equal(isSameOrigin(pathOrigin), false);
});

test("test_same_origin_accepts_only_loopback_or_configured_authorities", () => {
  /** @param {string} host @returns {Request} */
  const loopback = (host) => new Request("http://localhost:3000/api/ask", {
    method: "POST", headers: { Host: host, Origin: `http://${host}` },
  });
  const arbitraryHost = loopback("attacker.example:3000");

  assert.equal(isSameOrigin(loopback("localhost:3000")), true);
  assert.equal(isSameOrigin(loopback("127.0.0.1:3000")), true);
  assert.equal(isSameOrigin(loopback("[::1]:3000")), true);
  assert.equal(isSameOrigin(arbitraryHost), false);
  const prior = process.env.SAARTHI_ALLOWED_ORIGINS;
  process.env.SAARTHI_ALLOWED_ORIGINS = "https://app.example";
  try {
    assert.equal(isSameOrigin(new Request("https://app.example/api/ask", {
      method: "POST", headers: { Host: "app.example", Origin: "https://app.example" },
    })), true);
    assert.equal(isSameOrigin(new Request("http://localhost:3000/api/ask", {
      method: "POST", headers: { Host: "app.example", Origin: "https://app.example" },
    })), true);
  } finally {
    if (prior === undefined) delete process.env.SAARTHI_ALLOWED_ORIGINS;
    else process.env.SAARTHI_ALLOWED_ORIGINS = prior;
  }
});

test("test_access_failures_become_purgeable_authorization_responses", () => {
  assert.deepEqual(apiError({ error: "access_withdrawn" }), {
    error: "access_withdrawn",
    category: "access",
    purge_patient_state: true,
  });
  assert.deepEqual(apiError({ error: "model_validation_failed" }), {
    error: "service_unavailable",
    category: "unavailable",
    purge_patient_state: false,
  });
});

test("test_known_access_failures_are_safe_and_purge_patient_state", () => {
  assert.deepEqual(apiError(new Error("bind failed: access_withdrawn")), {
    error: "access_withdrawn",
    category: "access",
    purge_patient_state: true,
  });
  assert.deepEqual(apiError(new Error("Snowflake account=secret-user backend trace")), {
    error: "service_unavailable",
    category: "unavailable",
    purge_patient_state: false,
  });
});

test("test_malformed_and_oversized_json_return_bounded_errors", async () => {
  await assert.rejects(
    readJsonBody(new Request("https://app.example/api/ask", { method: "POST", body: "{" })),
    { message: "invalid_argument" },
  );
  await assert.rejects(
    readJsonBody(new Request("https://app.example/api/ask", {
      method: "POST", body: "x".repeat(25_000),
    })),
    { message: "request_too_large" },
  );
});

test("test_snowflake_configuration_and_write_errors_have_distinct_statuses", () => {
  const failure = apiError(new Error("snowflake_access_disabled"));
  assert.deepEqual(failure, {
    error: "snowflake_access_disabled",
    category: "configuration",
    purge_patient_state: false,
  });
  assert.equal(apiErrorStatus(failure.error), 503);
  assert.equal(apiErrorStatus("write_readback_unconfirmed"), 409);
  assert.equal(apiErrorStatus("write_readback_unavailable"), 503);
});

test("test_review_task_body_carries_a_bounded_per_attempt_request_id", () => {
  const base = { patientId: "PAT-DC-07", ruleId: "CLIN-PLT-001", action: "escalate" };
  assert.equal(validateReviewTaskBody({ ...base, requestId: "3f1c2a9e-0000-4000-8000-abcdef012345" })
    ?.requestId, "3f1c2a9e-0000-4000-8000-abcdef012345");
  for (const bad of ["short", "has space in it 12345", 42, "x".repeat(81)]) {
    assert.equal(validateReviewTaskBody({ ...base, requestId: bad }), null);
  }
});

test("test_malformed_patient_ids_are_rejected_before_any_record_read", async () => {
  const { isValidPatientId } = await import("./api-contracts.mjs");
  assert.equal(isValidPatientId("PAT-DC-07"), true);
  for (const bad of ["", "' OR 1=1", "a/b", "x".repeat(81), undefined, 7]) {
    assert.equal(isValidPatientId(bad), false);
  }
});

test("test_route_failures_use_typed_codes_and_never_leak_driver_text", () => {
  const leaked = apiError(new Error("SQL compilation error: table SAARTHI.CORE.X (acct ABC123)"),
    "timeline_unavailable");
  assert.deepEqual(leaked, { error: "timeline_unavailable", category: "unavailable",
    purge_patient_state: false });
  assert.equal(apiErrorStatus("timeline_unavailable"), 502);
  assert.equal(apiError(new Error("bind failed: no_patient_access")).purge_patient_state, true);
  assert.equal(apiErrorStatus(apiError(new Error("write_readback_unconfirmed")).error), 409);
});

test("round 2 error codes are catalogued with stable statuses", async () => {
  const { apiError, apiErrorStatus } = await import("./api-contracts.mjs");
  for (const code of ["task_transition_requires_review", "no_encounter", "reference_scope_unavailable"]) {
    const failure = apiError(code, "action_unavailable");
    assert.equal(failure.error, code);
    assert.equal(apiErrorStatus(code), 409);
  }
});

test('changed consent scope purges retained patient state', () => {
  assert.deepEqual(apiError(new Error('access_scope_changed')), {
    error: 'access_scope_changed', category: 'access', purge_patient_state: true,
  });
});

test("test_ask_body_accepts_up_to_five_typed_page_references", () => {
  const context = [{ kind: "check", id: "CLIN-PLT-001" }, { kind: "fact", id: "EVT-DC-04-PLT" }];
  assert.deepEqual(validateAskBody({ patientId: "PAT-DC-04", question: "Why?", context }),
    { patientId: "PAT-DC-04", question: "Why?", sourceScope: "patient", context });
});

test("test_ask_body_rejects_untyped_foreign_or_excess_page_references", () => {
  const ask = (context) => validateAskBody({ patientId: "PAT-DC-04", question: "Why?", context });
  assert.equal(ask([{ kind: "patient", id: "PAT-DC-05" }]), null);
  assert.equal(ask([{ kind: "check", id: "CLIN PLT; DROP" }]), null);
  assert.equal(ask([{ kind: "fact", id: "E1", value: "82000" }]), null);
  assert.equal(ask(Array.from({ length: 6 }, (_, i) => ({ kind: "fact", id: `E${i}` }))), null);
  assert.equal(ask("CLIN-PLT-001"), null);
});

test("test_context_preamble_is_deterministic_and_names_only_identifiers", () => {
  assert.equal(contextPreamble([]), "");
  assert.equal(contextPreamble([{ kind: "check", id: "CLIN-PLT-001" },
    { kind: "document", id: "DOC-LAB-DC-04" }]),
  "Items selected on screen: record check CLIN-PLT-001; document DOC-LAB-DC-04.\n\n");
});
