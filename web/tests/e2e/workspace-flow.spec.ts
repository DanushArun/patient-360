import { expect, test, type Page, type Route } from "@playwright/test";

const id = "PAT-DC-04";
const cutoff = "2026-09-23T14:14:48";
const gate = { gate: "Authorization", rule_id: "COV-AUTH-001", rule_version: 1,
  outcome: "conflicting", reason: "Two source dates disagree.", known_as_of: cutoff };
const patient = { patientId: id, patientName: "Fatima Begum", consentId: "CONSENT-SYNTHETIC-1",
  practitionerName: "Dr Example", treatingPractitionerName: "Dr Meera Iyer", language: "Tamil",
  nextVisit: "2026-09-24", scheduledAt: "2026-09-24T09:30:00", cycleNumber: 3,
  regimen: "Synthetic regimen", knownAsOf: cutoff, gates: [gate] };
const task = { taskId: "TASK-SYNTHETIC-1", issueId: "ISSUE-SYNTHETIC-1", owner: "Dr Meera Iyer",
  ownerId: "P-1", state: "open", action: "escalate", reason: "Verify these source dates.",
  createdAt: "2026-09-23T14:00:00", issueVersion: 1, isEvent: false, actor: "Dr Example" };

async function json(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function common(route: Route): Promise<boolean> {
  const url = new URL(route.request().url());
  if (url.pathname === `/api/patient/${id}`) { await json(route, patient); return true; }
  if (url.pathname.endsWith("/workspace") && url.searchParams.get("view") === "documents") {
    await json(route, { rows: [], expected_documents: [], known_as_of: cutoff }); return true;
  }
  if (url.pathname.endsWith("/workspace") && url.searchParams.get("view") === "facts") {
    await json(route, { domain: "labs", facts: [], known_as_of: cutoff,
      requested_known_as_of: cutoff, as_of_semantics: "ingested_cutoff" }); return true;
  }
  if (url.pathname.endsWith("/review-tasks")) {
    await json(route, { tasks: [], owners: [] }); return true;
  }
  if (url.pathname.endsWith("/evidence") && route.request().method() === "GET") {
    await json(route, { answers: [], packets: [] }); return true;
  }
  return false;
}

function answer(scope: string, clinical = false): unknown {
  const refusal = { reason_code: "class_a_clinical_judgment",
    message: "This clinical decision belongs to the treating practitioner.",
    practitioner: { practitioner_id: "P-1", name: "Dr Meera Iyer", nmc_registration_no: "SYN-1" },
    evidence_packet_offered: true };
  return { text: "Unsupported raw model prose must stay hidden", thinking: "", tools: [],
    suggested: [], gates: [], known_as_of: cutoff, error: null,
    artifact: { classification: clinical ? "CLASS_A" : "CLASS_B",
      overall_status: clinical ? "refused" : "supported", known_as_of: cutoff,
      claims: clinical ? [] : [{ text: scope === "reference" ? "Reference passage" : "Cited record",
        claim_type: "textual", evidence: [{ kind: "document_span", id: "ASSERT-SYN-1",
          doc_id: "DOC-SYNTHETIC-1", page_index: 0, char_start: 5, char_end: 12 }] }],
      limitations: [], ...(clinical ? { refusal } : {}) } };
}

async function openAsk(page: Page): Promise<void> {
  await page.goto(`/test-workspace/${id}`);
  await page.locator(".sa-patient-screen-header")
    .getByRole("button", { name: "Ask the record", exact: true }).click();
}

test("test_coverage_when_comparison_opens_preserves_sources_and_followup_draft", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    if (await common(route)) return;
    const data = { known_as_of: cutoff, requested_known_as_of: cutoff, rule: gate,
      observed_at: cutoff, authorizations: [{ auth_id: "AUTH-SYN-1", expires_at: "2026-09-30T00:00:00",
        status: "approved", payer_name: "Synthetic payer" }], letters: [{ assertion_id: "A-1",
        value: "2026-09-24", verification_status: "verified", doc_id: "DOC-SYNTHETIC-1",
        source_link_status: "verified_assertion_exact_page_span", page_index: 0,
        char_start: 5, char_end: 15, excerpt_start: 0, excerpt: "Date 2026-09-24 text" }] };
    await json(route, { rows: [data] });
  });
  await page.goto(`/test-workspace/${id}#coverage`);
  await page.getByRole("button", { name: "Compare sources", exact: true }).click();
  const comparison = page.getByRole("region", { name: "Authorization source comparison" });
  await expect(comparison.getByRole("heading", { name: "Authorization dates disagree" }))
    .toBeVisible();
  await expect(comparison).toContainText("No single valid-through date is asserted.");
  await expect(comparison.getByRole("link", { name: /Open exact source span/ }).first())
    .toHaveAttribute("href", /known_as_of=.*start=5.*end=15/);
  await page.screenshot({ path: "../planning/dashboard-release/evidence/coverage-comparison.png",
    fullPage: true });
  await comparison.getByRole("button", { name: "Prepare review task" }).click();
  await page.getByRole("button", { name: "Escalate to treating doctor" }).click();
  await expect(page.getByRole("region", { name: "Follow-up draft" }))
    .toContainText("Draft · Not created");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await comparison.getByRole("button", { name: "Back to coverage" }).click();
  await expect(page).toHaveURL(/#coverage$/);
});

test("test_answers_when_scope_changes_and_clinical_question_is_refused_keeps_boundaries",
  async ({ page }) => {
  const packets: unknown[] = [];
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/ask") {
      const body = route.request().postDataJSON();
      await json(route, answer(body.sourceScope, body.question.includes("safe"))); return;
    }
    if (url.pathname.endsWith("/evidence") && route.request().method() === "POST") {
      packets.push(route.request().postDataJSON());
      await json(route, { read_back_confirmed: true, practitioner_name: "Dr Meera Iyer" }); return;
    }
    if (!(await common(route))) await route.abort();
  });
  await openAsk(page);
  const input = page.getByRole("textbox", { name: "Question about the selected patient" });
  await input.fill("What is documented?"); await input.press("Enter");
  await expect(page.getByText("Cited record", { exact: true })).toBeVisible();
  await expect(page.getByText("Unsupported raw model prose must stay hidden")).toHaveCount(0);
  await page.getByLabel("Search in").selectOption("reference");
  await expect(page.getByText("Cited record", { exact: true })).toHaveCount(0);
  await input.fill("What does the reference say?"); await input.press("Enter");
  await expect(page.getByText("Reference passage", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open cited source" })).toHaveCount(0);
  await page.getByLabel("Search in").selectOption("patient");
  await input.fill("Is it safe to proceed?"); await input.press("Enter");
  await page.getByRole("button", { name: "Prepare evidence packet for Dr Meera Iyer" }).click();
  await expect(page.getByText(/Prepared for Dr Meera Iyer/)).toBeVisible();
  expect(packets).toHaveLength(1);
});

test("test_task_update_when_receipt_is_uncertain_locks_draft_and_retries_same_request",
  async ({ page }) => {
  const writes: Record<string, unknown>[] = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    if (request.method() === "PATCH") {
      writes.push(request.postDataJSON());
      await json(route, writes.length === 1 ? { error: "write_unconfirmed" }
        : { read_back_confirmed: true }, writes.length === 1 ? 503 : 200); return;
    }
    if (new URL(request.url()).pathname.endsWith("/review-tasks")) {
      await json(route, { tasks: [{ ...task, state: writes.length > 1 ? "acknowledged" : "open",
        issueVersion: writes.length > 1 ? 2 : 1 }], owners: [{ id: "P-1", name: "Dr Meera Iyer" }] }); return;
    }
    if (!(await common(route))) await route.abort();
  });
  await page.goto(`/test-history/${id}`);
  await page.getByText("Update task", { exact: true }).click();
  await page.getByRole("textbox", { name: "Reason", exact: true }).fill("Reviewed both source dates.");
  await page.getByRole("button", { name: "Save task update" }).click();
  await expect(page.getByRole("textbox", { name: "Reason", exact: true })).toBeDisabled();
  await page.reload();
  await page.getByText("Update task", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Reason", exact: true }))
    .toHaveValue("Reviewed both source dates.");
  await expect(page.getByRole("textbox", { name: "Reason", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Retry task update" }).click();
  await expect(page.getByText("Review task · acknowledged", { exact: true })).toBeVisible();
  expect(writes[1]).toEqual(writes[0]);
});
