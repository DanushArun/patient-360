import { expect, test, type Page } from "@playwright/test";

const patientId = "PAT-DC-04";
const fixtureRoute = `/test-workspace/${patientId}`;
const knownAsOf = "2026-09-23T14:14:48";

const patient = {
  patientId, patientName: "Fatima Begum", consentId: "CONSENT-SYNTHETIC-1",
  practitionerName: "Dr Example", language: "Tamil", nextVisit: "2026-09-24",
  scheduledAt: "2026-09-24T09:30:00", cycleNumber: 3, regimen: "Synthetic regimen",
  knownAsOf, gates: [],
};

async function openFacts(page: Page): Promise<void> {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    let body: unknown;
    if (url.pathname === `/api/patient/${patientId}`) body = patient;
    else if (url.pathname === `/api/patient/${patientId}/review-tasks`) {
      body = { tasks: [], owners: [] };
    } else if (url.pathname === `/api/patient/${patientId}/workspace`) {
      body = url.searchParams.get("view") === "documents"
        ? { rows: [], known_as_of: knownAsOf } : factsResponse(url.searchParams.get("domain"));
    } else {
      await route.abort("failed");
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify(body) });
  });
  await page.goto(fixtureRoute);
  await page.getByRole("navigation", { name: "Patient sections" })
    .getByRole("button", { name: "Facts" }).click();
}

function factsResponse(domain: string | null): unknown {
  if (domain !== "labs") return { domain, facts: [], known_as_of: knownAsOf,
    requested_known_as_of: knownAsOf, as_of_semantics: "current_at_query" };
  return {
    domain: "labs",
    facts: [
      { concept: "Platelets", value: 82000, value_state: "present", value_text: null,
        unit: "/µL", is_derived: false, event_time: "2026-09-22T08:30:00",
        source_recorded_at: "2026-09-22T09:00:00", ingested_at: "2026-09-22T09:20:00",
        event_id: "EVT-PLT-1", source_event_ids: [], source_assertion_ids: ["ASSERT-PLT-1"],
        source_document_ids: ["DOC-CBC-1"] },
      { concept: "ANC", value: 2100, value_state: "present", value_text: null,
        unit: "/µL", is_derived: true, derivation: "SQL-derived from returned source events",
        event_time: "2026-09-22T08:30:00", source_recorded_at: "2026-09-22T09:00:00",
        ingested_at: "2026-09-22T09:20:00", event_id: "EVT-ANC-1",
        source_event_ids: ["EVT-WBC-1", "EVT-NEUT-1"],
        source_assertion_ids: ["ASSERT-ANC-1"], source_document_ids: ["DOC-CBC-1"] },
      { concept: "Final pathology", value: null, value_state: "not_received", value_text: null,
        unit: null, is_derived: false, event_time: null, source_recorded_at: null,
        ingested_at: null, event_id: "EVT-PATH-1", source_event_ids: [],
        source_assertion_ids: [], source_document_ids: [] },
    ],
    known_as_of: knownAsOf,
    requested_known_as_of: knownAsOf,
    as_of_semantics: "ingested_cutoff",
  };
}

test("test_facts_when_sql_labs_return_then_render_state_clocks_sources", async ({ page }) => {
  await openFacts(page);
  const facts = page.getByRole("region", { name: "Patient facts" });
  await expect(facts.getByRole("heading", { name: "Lab records" })).toBeVisible();
  await expect(facts.getByRole("table", { name: "Lab facts" })).toContainText("Platelets");
  await expect(facts.getByRole("table", { name: "Lab facts" })).toContainText("82000");
  await expect(facts).toContainText("Not received");
  await expect(facts).toContainText("ingested through");

  await facts.getByRole("button", { name: /Platelets details/i }).click();
  await expect(facts).toContainText("2026-09-22T08:30:00");
  await expect(facts).toContainText("EVT-PLT-1");
  await expect(facts.getByRole("link", { name: /Open source document DOC-CBC-1/ }).first())
    .toHaveAttribute("href", /DOC-CBC-1.*known_as_of=2026-09-23T14%3A14%3A48.*return=facts/,
  );
  await page.screenshot({ path: "../planning/dashboard-release/evidence/facts-desktop.png",
    fullPage: true });
});

test("test_facts_when_viewport_is_389_pixels_then_rows_stay_readable", async ({ page }) => {
  await page.setViewportSize({ width: 389, height: 844 });
  await openFacts(page);
  const facts = page.getByRole("region", { name: "Patient facts" });
  const platelet = facts.getByRole("article").filter({ hasText: "Platelets" });
  await expect(platelet.getByText("Platelets", { exact: true })).toBeVisible();
  await expect(platelet.getByText("82000", { exact: true })).toBeVisible();
  const width = await facts.evaluate((element) => ({
    scroll: element.scrollWidth, client: element.clientWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);
  await page.screenshot({ path: "../planning/dashboard-release/evidence/facts-phone.png",
    fullPage: true });
});

test("test_facts_when_mutable_domain_reads_then_show_query_time_basis", async ({ page }) => {
  await openFacts(page);
  const facts = page.getByRole("region", { name: "Patient facts" });
  await facts.getByRole("group", { name: "Fact domain" })
    .getByRole("button", { name: "Coverage" }).click();
  await expect(facts).toContainText("Current facts read at 2026-09-23T14:14:48");
  await expect(facts).toContainText("requested historical cutoff does not apply");
});
