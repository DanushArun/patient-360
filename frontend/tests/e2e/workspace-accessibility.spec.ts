import { expect, test, type Page } from "@playwright/test";

const patientId = "PAT-DC-04";
const fixtureRoute = `/test-workspace/${patientId}`;
const knownAsOf = "2026-09-23T14:14:48";
const sourceText = "HER2 immunohistochemistry: grade III, IHC 2+. "
  + "The original signed report remains the source of this recorded result. ".repeat(8);
type ApiMocks = { assertNoUnexpected: () => void };

const patient = {
  patientId,
  patientName: "Fatima Begum",
  consentId: "CONSENT-SYNTHETIC-1",
  practitionerName: "Dr Example",
  language: "Tamil",
  nextVisit: "2026-09-24",
  scheduledAt: "2026-09-24T09:30:00",
  cycleNumber: 3,
  regimen: "Synthetic regimen",
  knownAsOf,
  gates: [{
    gate: "Platelet count", rule_id: "CLIN-PLT-001", rule_version: 1,
    outcome: "fail", severity: "blocker", reason: "Platelet result needs review.",
    evidence_ids: ["ASSERT-SYNTHETIC-1"], known_as_of: knownAsOf,
  }],
};

async function installSqlApiMocks(page: Page): Promise<ApiMocks> {
  const unexpected: string[] = [];
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const result = sqlResponse(url);
    if (result) {
      await route.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify(result) });
      return;
    }
    unexpected.push(`${request.method()} ${url.pathname}${url.search}`);
    await route.abort("failed");
  });
  return { assertNoUnexpected: () => expect(unexpected).toEqual([]) };
}

function sqlResponse(url: URL): unknown | null {
  if (url.pathname === `/api/patient/${patientId}` && url.search === "") return patient;
  if (url.pathname === `/api/patient/${patientId}/review-tasks`) {
    return { tasks: [], owners: [] };
  }
  if (url.pathname !== `/api/patient/${patientId}/workspace`) return null;
  if (url.searchParams.get("view") !== "documents") {
    return { domain: "labs", facts: [], known_as_of: knownAsOf,
      binding_id: "BIND-1" };
  }
  return url.searchParams.has("documentId")
    ? { rows: [documentPage()], known_as_of: knownAsOf, binding_id: "BIND-1" }
    : { rows: [documentListItem()], known_as_of: knownAsOf, binding_id: "BIND-1" };
}

function documentListItem(): Record<string, unknown> {
  return { doc_id: "DOC-SYNTHETIC-1", doc_type: "Lab report", version: 1,
    source_quality: "clean_pdf", source_recorded_at: "2026-09-22T10:00:00",
    event_time: "2026-09-22T09:30:00", ingested_at: "2026-09-22T10:10:00", page_count: 1 };
}

function documentPage(): Record<string, unknown> {
  return { DOC_ID: "DOC-SYNTHETIC-1", PAGE_INDEX: 0, TEXT: sourceText,
    DOC_TYPE: "Lab report", SCOPE: "patient", VERSION: 1,
    SOURCE_QUALITY: "clean_pdf", SOURCE_RECORDED_AT: "2026-09-22T10:00:00",
    EVENT_TIME: "2026-09-22T09:30:00", INGESTED_AT: "2026-09-22T10:10:00" };
}

async function openWorkspace(page: Page, width: number): Promise<ApiMocks> {
  await page.setViewportSize({ width, height: 900 });
  const mocks = await installSqlApiMocks(page);
  await page.goto(fixtureRoute);
  await expect(page.getByRole("heading", { name: "Fatima Begum" })).toBeVisible();
  return mocks;
}

test("test_mobile_evidence_panel_when_closed_returns_focus_to_the_selected_check",
  async ({ page }) => {
  const mocks = await openWorkspace(page, 390);
  const trigger = page.getByRole("button", { name: "View check" }).first();
  await trigger.click();
  await expect(page.getByRole("heading", { name: "Selected evidence" })).toBeFocused();
  await page.getByRole("button", { name: "Close" }).click();
  await expect(trigger).toBeFocused();
  mocks.assertNoUnexpected();
});

test("test_mobile_evidence_dialog_when_open_contains_focus_and_escape_restores_trigger",
  async ({ page }) => {
  const mocks = await openWorkspace(page, 390);
  const trigger = page.getByRole("button", { name: "View check" }).first();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Selected evidence" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("heading", { name: "Selected evidence" })).toBeFocused();
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(() => {
      const active = document.activeElement;
      const currentDialog = document.querySelector("dialog");
      return { inside: currentDialog?.contains(active), tag: active?.tagName,
        label: active?.getAttribute("aria-label"), text: active?.textContent?.slice(0, 80),
        open: currentDialog?.open, modal: currentDialog?.matches(":modal") };
    });
    expect(focus.inside, `Tab ${index + 1} focus escaped: ${JSON.stringify(focus)}`).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  mocks.assertNoUnexpected();
});

test("test_mobile_patient_section_targets_when_visible_are_at_least_44_pixels_tall",
  async ({ page }) => {
  const mocks = await openWorkspace(page, 390);
  const sizes = await page.getByRole("navigation", { name: "Patient sections" })
    .getByRole("button").evaluateAll((buttons) => buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return { label: button.textContent?.trim(), height: rect.height };
    }));

  expect(sizes.length).toBeGreaterThan(0);
  expect(sizes.filter(({ height }) => height < 44)).toEqual([]);
  mocks.assertNoUnexpected();
});

test("test_zoom_200_equivalent_when_document_open_reflows_source_without_horizontal_clipping",
  async ({ page }) => {
  const mocks = await openWorkspace(page, 640);
  await page.goto("/test-source");
  const source = page.locator(".sa-source-page-text");
  await expect(source).toContainText("HER2 immunohistochemistry: grade III, IHC 2+");
  const layout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    page: document.documentElement.scrollWidth,
    source: document.querySelector(".sa-source-page-text")?.getBoundingClientRect().width ?? 0,
    sourceContent: document.querySelector(".sa-source-page-text")?.scrollWidth ?? 0,
  }));

  expect(layout.viewport).toBe(640);
  expect(layout.page).toBeLessThanOrEqual(layout.viewport);
  expect(layout.sourceContent).toBeLessThanOrEqual(layout.source + 1);
  mocks.assertNoUnexpected();
});

test("test_mobile_source_when_long_text_is_open_wraps_and_remains_readable", async ({ page }) => {
  const mocks = await openWorkspace(page, 390);
  await page.goto("/test-source");
  const source = page.locator(".sa-source-page-text");
  await expect(source).toContainText("original signed report remains the source");
  const dimensions = await source.evaluate((element) => ({
    width: element.getBoundingClientRect().width,
    content: element.scrollWidth,
    height: element.scrollHeight,
  }));

  expect(dimensions.width).toBeGreaterThan(0);
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.width + 1);
  expect(dimensions.height).toBeGreaterThan(21);
  mocks.assertNoUnexpected();
});
