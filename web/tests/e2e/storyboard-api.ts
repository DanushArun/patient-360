import { type Page, type Route } from "@playwright/test";

export const patientId = "PAT-DC-04";
export const cutoff = "2026-10-01T09:42:00";
const clocks = { event_time: "2026-09-30T08:30:00",
  source_recorded_at: "2026-09-30T09:00:00", ingested_at: "2026-09-30T09:20:00" };
const gate = (rule: string, outcome: string, reason: string): Record<string, unknown> => ({
  gate: rule.startsWith("CLIN") ? "Platelet check" : rule.startsWith("DOC")
    ? "Final pathology" : "Authorization", rule_id: rule, rule_version: 1,
  outcome, reason, severity: "blocker", known_as_of: cutoff,
  evidence_ids: rule.startsWith("DOC") ? [] : ["ASSERT-SYN-1"],
});
export const gates = [gate("CLIN-PLT-001", "fail", "Platelets 82,000 /µL, below rule threshold."),
  gate("DOC-PATH-001", "not_evaluated", "Final pathology report not received."),
  gate("COV-AUTH-001", "conflicting", "Authorization dates disagree.")];
export const patient = { patientId, patientName: "Fatima Begum", consentId: "CONSENT-SYN-1",
  practitionerName: "Dr Meera Iyer", treatingPractitionerName: "Dr Meera Iyer", language: "Tamil",
  nextVisit: "2026-10-03", scheduledAt: "2026-10-03T09:00:00", cycleNumber: 3,
  regimen: "Carboplatin + Paclitaxel", knownAsOf: cutoff, gates };
export const documents = [{ doc_id: "DOC-CBC-1", doc_type: "CBC report", version: 1,
  page_count: 1, scope: "patient", source_facility: "City Labs (synthetic)",
  missingness_state: "present", assertion_count: 2, verified_assertions: 2,
  conflicting_assertions: 0, verification_observed_at: cutoff, ...clocks },
{ doc_id: "DOC-LETTER-1", doc_type: "Authorization letter", version: 1,
  page_count: 1, scope: "patient", source_facility: "HealthSure TPA (synthetic)",
  missingness_state: "conflicting", assertion_count: 1, verified_assertions: 1,
  conflicting_assertions: 1, verification_observed_at: cutoff,
  event_time: "2026-09-28T09:00:00", source_recorded_at: "2026-09-28T09:00:00",
  ingested_at: "2026-09-29T09:00:00" }];
const expected = [{ title: "Final pathology report", rule_id: "DOC-PATH-001",
  missingness_state: "not_received", reason: "Awaiting the final report from Metro Pathology." }];
const fact = { concept: "Platelets", value: 82000, unit: "/µL", value_state: "present",
  event_id: "EVT-PLT-1", is_derived: false, source_assertion_ids: ["ASSERT-SYN-1"],
  source_document_ids: ["DOC-CBC-1"], ...clocks };
const coverage = { known_as_of: cutoff, requested_known_as_of: cutoff, observed_at: cutoff,
  rule: gates[2], authorizations: [{ auth_id: "AUTH-SYN-1", status: "approved",
    expires_at: "2026-10-05T00:00:00", payer_name: "HealthSure TPA (synthetic)" }],
  letters: [{ assertion_id: "ASSERT-LETTER-1", value: "2026-09-30",
    verification_status: "verified", doc_id: "DOC-LETTER-1", page_index: 0,
    source_link_status: "verified_assertion_exact_page_span", char_start: 21, char_end: 31,
    excerpt_start: 0, excerpt: "Authorization until: 2026-09-30. Issued 28 September.",
    ...clocks }] };
export const task = { taskId: "TASK-SYN-1", issueId: "ISSUE-1", owner: "Dr Meera Iyer",
  ownerId: "P-1", state: "open", action: "escalate", reason: "Verify both authorization dates.",
  createdAt: "2026-10-01T10:00:00", issueVersion: 1, isEvent: false, actor: "Dr Meera Iyer" };

export async function installStoryboardApi(page: Page): Promise<{ unexpected: string[] }> {
  const unexpected: string[] = [];
  let updated = false;
  let created = false;
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "POST" && url.pathname === `/api/patient/${patientId}`) {
      updated = true; await json(route, { ...patient }); return;
    }
    if (url.pathname === `/api/patient/${patientId}`) {
      await json(route, updated ? updatedPatient() : patient); return;
    }
    if (url.pathname === "/api/review-task") {
      created = true; await json(route, { task_id: task.taskId, state: "open",
        version: 1, read_back_confirmed: true }); return;
    }
    if (url.pathname.endsWith("/review-tasks")) {
      await json(route, { tasks: created ? [task] : [], changes: [{ before: { known_as_of: cutoff,
        rule_id: "COV-AUTH-001", rule_version: 1, outcome: "conflicting",
        reason: "Authorization dates disagree." }, after: { known_as_of: "2026-10-02T10:00:00",
        rule_id: "COV-AUTH-001", rule_version: 1, outcome: "pass",
        reason: "Corrected authorization values agree." }, fields: [{
          label: "Authorization letter valid through", before: "30 Sep 2026", after: "5 Oct 2026"
        }] }], owners: [{ id: "P-1", name: task.owner }] });
      return;
    }
    if (url.pathname.endsWith("/evidence")) {
      await json(route, { answers: [], packets: [], read_back_confirmed: true,
        practitioner_name: task.owner }); return;
    }
    if (url.pathname === "/api/ask") {
      await json(route, answer(request.postDataJSON().question.includes("safe"))); return;
    }
    const body = workspaceResponse(url, updated);
    if (body) { await json(route, body); return; }
    unexpected.push(`${request.method()} ${url.pathname}${url.search}`);
    await route.abort();
  });
  return { unexpected };
}

function workspaceResponse(url: URL, updated: boolean): unknown | null {
  const asOf = updated ? "2026-10-02T10:00:00" : cutoff;
  if (url.pathname.endsWith("/timeline")) return { known_as_of: cutoff, total_events: 1,
    timeline_limit: 100, truncated: false, timeline: [fact], provenance_observed_at: cutoff };
  if (!url.pathname.endsWith("/workspace")) return null;
  if (url.searchParams.get("view") === "documents") return { known_as_of: asOf,
    rows: updated ? [...documents.map((doc) => doc.doc_id === "DOC-LETTER-1"
      ? { ...doc, missingness_state: "superseded" } : doc), { ...documents[1],
      doc_id: "DOC-LETTER-2", doc_type: "Corrected authorization letter", version: 2,
      missingness_state: "present" }] : documents, expected_documents: expected };
  if (url.searchParams.get("view") === "facts") return { domain: "labs", facts: [fact],
    known_as_of: cutoff, requested_known_as_of: cutoff, as_of_semantics: "ingested_cutoff" };
  if (url.searchParams.get("view") === "coverage_comparison") return { rows: [coverage] };
  return null;
}

function updatedPatient(): Record<string, unknown> {
  return { ...patient, knownAsOf: "2026-10-02T10:00:00", gates: [gates[0], gates[1],
    { ...gates[2], outcome: "pass", reason: "Corrected authorization values agree.",
      known_as_of: "2026-10-02T10:00:00" }] };
}

function answer(clinical: boolean): unknown {
  return { text: "Hidden raw prose", thinking: "", tools: [], suggested: [], gates: [],
    known_as_of: cutoff, artifact: { classification: clinical ? "CLASS_A" : "CLASS_B",
      overall_status: clinical ? "refused" : "partial", known_as_of: cutoff,
      claims: clinical ? [] : [{ text: "The authorization letter records 30 September.",
        claim_type: "textual", evidence: [{ kind: "document_span", id: "ASSERT-LETTER-1",
          doc_id: "DOC-LETTER-1", page_index: 0, char_start: 21, char_end: 31 }] }],
      limitations: clinical ? [] : ["Final pathology report not received."],
      ...(clinical ? { refusal: { reason_code: "class_a_clinical_judgment",
        message: "The treating practitioner must decide whether treatment can proceed.",
        practitioner: { practitioner_id: "P-1", name: task.owner, nmc_registration_no: "SYN-1" },
        evidence_packet_offered: true } } : {}) } };
}

async function json(route: Route, body: unknown): Promise<void> {
  await route.fulfill({ contentType: "application/json", body: JSON.stringify(body) });
}
