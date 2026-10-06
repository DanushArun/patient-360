import { expect, test, type Page } from "@playwright/test";

const patientId = "PAT-DC-04";
const fixtureRoute = `/test-workspace/${patientId}`;
const knownAsOf = "2026-10-01T09:42:00";

const patient = {
  patientId,
  patientName: "Fatima Begum",
  consentId: "CONSENT-SYNTHETIC-1",
  practitionerName: "Dr Example",
  language: "Tamil",
  nextVisit: "2026-10-03",
  scheduledAt: "2026-10-03T09:30:00",
  cycleNumber: 3,
  regimen: "Synthetic regimen",
  knownAsOf,
  gates: [{
    gate: "documentation",
    rule_id: "DOC-PATH-001",
    rule_version: 1,
    outcome: "not_evaluated",
    reason: "1 pathology report(s) preliminary/pending - awaiting final",
    evidence_ids: ["DOC-PRELIMINARY-1"],
    known_as_of: knownAsOf,
  }],
};

const documents = [
  {
    doc_id: "DOC-CBC-1", doc_type: "CBC report", scope: "patient", version: 1,
    source_quality: "clean_pdf", source_facility: "City Labs (synthetic)",
    document_status: "active", verified_assertions: 2, conflicting_assertions: 0,
    assertion_count: 2, verification_observed_at: "2026-10-01T09:43:00",
    source_recorded_at: "2026-09-30T09:00:00", event_time: "2026-09-30T08:30:00",
    ingested_at: "2026-09-30T09:20:00", page_count: 1,
  },
  {
    doc_id: "DOC-LETTER-1", doc_type: "Authorization letter", scope: "patient",
    version: 1, source_quality: "clean_pdf", source_facility: "HealthSure TPA (synthetic)",
    document_status: "active", verified_assertions: 1, conflicting_assertions: 1,
    assertion_count: 2, verification_observed_at: "2026-10-01T09:43:00",
    source_recorded_at: "2026-09-28T00:00:00", event_time: "2026-09-28T00:00:00",
    ingested_at: "2026-09-29T10:00:00", page_count: 2,
  },
  {
    doc_id: "DOC-PRELIMINARY-1", doc_type: "Preliminary pathology", scope: "patient",
    version: 1, source_quality: "clean_pdf", source_facility: "Metro Pathology (synthetic)",
    document_status: "active", verified_assertions: 1, conflicting_assertions: 0,
    assertion_count: 1, verification_observed_at: "2026-10-01T09:43:00",
    source_recorded_at: "2026-09-25T09:00:00", event_time: "2026-09-25T08:30:00",
    ingested_at: "2026-09-25T09:20:00", page_count: 1,
  },
];

async function openDocuments(page: Page, width = 1440): Promise<void> {
  await page.setViewportSize({ width, height: 1000 });
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let body: unknown;
    if (url.pathname === `/api/patient/${patientId}`) body = patient;
    else if (url.pathname === `/api/patient/${patientId}/review-tasks`) {
      body = { tasks: [], owners: [] };
    } else if (url.pathname === `/api/patient/${patientId}/workspace`
      && url.searchParams.get("view") === "documents") {
      body = { rows: documents, known_as_of: knownAsOf,
        expected_documents: [{ title: "Final pathology", missingness_state: "not_received",
          rule_id: "DOC-PATH-001", rule_version: 1, reason: patient.gates[0].reason,
          known_as_of: knownAsOf }],
        requested_known_as_of: knownAsOf, as_of_semantics: "ingested_cutoff" };
    } else {
      await route.abort("failed");
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(body) });
  });
  await page.goto(fixtureRoute);
  await page.getByRole("navigation", { name: "Patient sections" })
    .getByRole("button", { name: "Documents" }).click();
}

test("test_documents_when_authorized_metadata_returns_show_clocks_assertions_and_expected_rule",
  async ({ page }) => {
  await openDocuments(page);
  const library = page.getByRole("region", { name: "Patient documents" });
  // R2: the exact stored cutoff is rendered (datetime); the visible clock reads naturally.
  await expect(library.locator('time[datetime="2026-10-01T09:42:00"]').first()).toBeVisible();
  await expect(library).toContainText("Known as of 1 Oct 2026, 09:42");
  await expect(library).toContainText("City Labs (synthetic)");
  await expect(library).toContainText("30 Sept 2026, 08:30");
  await expect(library).toContainText("30 Sept 2026, 09:00");
  await expect(library).toContainText("30 Sept 2026, 09:20");
  await expect(library).toContainText("2 assertions · 2 verified · 0 conflicting");
  await expect(library).toContainText("Assertions, current at query");
  await expect(library).toContainText("Final pathology");
  await expect(library).toContainText("Not received");
  await expect(library).toContainText("Not received does not mean a negative result.");

  await expect(library.getByRole("link", { name: "Open source" })).toHaveAttribute(
    "href",
    "/patient/PAT-DC-04/documents/DOC-CBC-1?page=0"
      + "&known_as_of=2026-10-01T09%3A42%3A00&return=documents",
  );
  await library.getByRole("button", { name: "Request document" }).click();
  await expect(page.getByRole("heading", { name: "Selected evidence" })).toBeVisible();
});

test("test_documents_when_view_filters_change_then_expected_rows_and_types_stay_scoped",
  async ({ page }) => {
  await openDocuments(page);
  const library = page.getByRole("region", { name: "Patient documents" });
  await library.getByRole("button", { name: "By type" }).click();
  await expect(library.getByRole("heading", { name: "CBC report" })).toBeVisible();
  await library.getByRole("button", { name: "Expected documents" }).click();
  await expect(library).toContainText("Final pathology");
  await expect(library.locator("tbody")).not.toContainText("CBC report");
  await library.getByLabel("Search documents").fill("not found");
  await expect(library).toContainText("No documents match these filters.");
  await library.getByRole("button", { name: "Reset filters" }).click();
  await expect(library).toContainText("Final pathology");
});

test("test_documents_when_phone_viewport_then_rows_fit_and_controls_are_touch_sized",
  async ({ page }) => {
  await openDocuments(page, 389);
  const library = page.getByRole("region", { name: "Patient documents" });
  const dimensions = await library.evaluate((element) => ({
    scroll: element.scrollWidth,
    client: element.clientWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
  for (const name of ["Table", "By type", "Expected documents"]) {
    const box = await library.getByRole("button", { name }).boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});
