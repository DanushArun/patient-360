import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { apiError, apiErrorStatus } from "./api-contracts.mjs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("test_previously_uncatalogued_error_codes_are_typed_and_have_ui_copy", () => {
  const copilot = read("../components/workspace-patient-copilot.tsx");
  for (const code of ["readiness_refresh_unavailable", "workspace_data_unavailable",
    "record_service_unavailable", "service_unavailable"]) {
    assert.equal(apiError(code).category, "unavailable", code);
    assert.equal(apiErrorStatus(code), 502, code);
  }
  for (const code of ["workspace_data_unavailable", "record_service_unavailable",
    "service_unavailable", "reference_scope_unavailable"]) {
    assert.ok(copilot.includes(`${code}:`), `UI copy for ${code}`);
  }
  assert.equal(apiError("reference_scope_unavailable").category, "conflict");
  assert.equal(apiErrorStatus("reference_scope_unavailable"), 409);
});

test("test_reference_scope_is_answered_from_the_reference_corpus_alone", () => {
  const route = read("../app/api/ask/route.ts");
  const patient = read("./patient.ts");
  const screen = read("../components/workspace-patient-screen.tsx");
  // R6: the reference branch runs before the record tools and the patient gateway, sends only
  // the question, and drops attached patient items.
  assert.match(route, /const context = scope === "reference" \? \[\] : body\.context/);
  const branch = patient.indexOf('if (scope === "reference")');
  assert.ok(branch > 0 && branch < patient.indexOf("matchRecordTool(tooling"));
  assert.match(patient, /SEARCH_REFERENCE_DOCUMENTS\(\?,NULL,NULL\)/);
  // The live copilot only asks the patient record, so reference questions bypass it.
  assert.match(screen, /if \(reference\) \{ void model\.chat\.send\(text, "reference"\); return; \}/);
});

test("test_timeline_and_labs_share_one_value_state_rule_in_sql", () => {
  const rule = (text) => {
    const a = text.indexOf("'value_state', CASE");
    const b = text.indexOf("ELSE 'unreadable' END", a) + "ELSE 'unreadable' END".length;
    assert.ok(a > 0 && b > a);
    return text.slice(a, b).replace(/--[^\n]*/g, "").replace(/\bt\.source_status\b/g, "ce.status")
      .replace(/\bt\.display\b/g, "ce.display").replace(/\bt\.code\b/g, "ce.code")
      .replace(/\bt\./g, "h.").replace(/\s+/g, " ");
  };
  const timeline = read("../../backend/sql/procedures/tools/06_get_timeline.sql");
  const labs = read("../../backend/sql/procedures/web_reads.sql");
  assert.equal(rule(timeline), rule(labs));
  assert.ok(!timeline.includes("ELSE 'not_received'"));
  assert.match(rule(timeline), /WHEN ce\.status = 'cancelled' THEN 'not_received'/);
});
