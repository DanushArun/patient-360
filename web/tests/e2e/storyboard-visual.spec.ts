import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { mkdir } from "node:fs/promises";
import { cutoff, patientId, installStoryboardApi } from "./storyboard-api";

const workspace = `/test-workspace/${patientId}`;
const evidence = path.resolve(__dirname, "../../../planning/dashboard-release/evidence/screens");

async function capture(page: Page, screen: string): Promise<void> {
  await mkdir(evidence, { recursive: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(evidence, `${screen}.png`), fullPage: true });
}

async function section(page: Page, name: string): Promise<void> {
  await page.getByRole("navigation", { name: "Patient sections" })
    .getByRole("button", { name, exact: true }).click();
}

test("test_every_storyboard_screen_when_bound_contracts_return_captures_actual_frontend",
  async ({ page }) => {
  test.setTimeout(90000);
  page.setDefaultTimeout(8000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  const tracker = await installStoryboardApi(page);
  await captureWorklists(page);
  await capturePatientRecord(page);
  await captureFollowup(page);
  await captureAnswerAndFamily(page);
  await captureRecoveryAndReturn(page);
  expect(tracker.unexpected).toEqual([]);
});

async function captureWorklists(page: Page): Promise<void> {
  await page.goto("/test-daycare");
  await expect(page.getByRole("heading", { name: "Day care", exact: true })).toBeVisible();
  await capture(page, "01-daycare");
  await page.getByRole("button", { name: "Visits", exact: true }).click();
  await expect(page.getByRole("region", { name: "Visit list" })).toBeVisible();
  await capture(page, "02-visits");
  await page.getByRole("button", { name: "Select patient", exact: true }).click();
  await page.getByRole("textbox", { name: "Search patient name or ID within your care team" }).fill("Fatima");
  await expect(page.getByRole("radio", { name: /Fatima/ })).toBeVisible();
  await capture(page, "03-search");
  await page.keyboard.press("Escape");
}

async function capturePatientRecord(page: Page): Promise<void> {
  await page.goto(workspace);
  await expect(page.locator(".sa-utility-asof")).toContainText("1 Oct 2026");
  await expect(page.getByRole("region", { name: "Overview documents" }))
    .toContainText("CBC report");
  await capture(page, "04-overview");
  await section(page, "Facts");
  await expect(page.getByRole("table", { name: "Lab facts" })).toContainText("82000");
  await capture(page, "05-facts");
  await section(page, "Timeline");
  await expect(page.getByRole("region", { name: "Patient timeline" })).toContainText("Platelets");
  await capture(page, "06-timeline");
  await section(page, "Documents");
  await expect(page.getByRole("region", { name: "Patient documents" }))
    .toContainText("Authorization letter");
  await capture(page, "07-documents");
  await section(page, "Overview");
  await page.getByRole("button", { name: "View check", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Selected evidence" })).toBeVisible();
  await capture(page, "08-evidence");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await section(page, "Coverage");
  await expect(page.getByRole("button", { name: "Compare sources", exact: true })).toBeVisible();
  await capture(page, "09-coverage");
}

async function captureFollowup(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Compare sources", exact: true }).click();
  await expect(page.getByRole("region", { name: "Authorization source comparison" }))
    .toContainText("2026-09-30");
  await capture(page, "10-comparison");
  await page.getByRole("button", { name: "Prepare review task" }).click();
  await page.getByRole("button", { name: "Escalate to treating doctor" }).click();
  await expect(page.getByRole("region", { name: "Follow-up draft" })).toContainText("Not created");
  await capture(page, "11-draft");
  await page.getByRole("button", { name: "Create escalation", exact: true }).click();
  await expect(page.getByText("Task filed", { exact: true })).toBeVisible();
  await capture(page, "12-receipt");
  await page.goto("/test-queue");
  await expect(page.getByRole("complementary", { name: "Task details" })).toBeVisible();
  await capture(page, "13-queue");
  await page.goto(`/test-history/${patientId}`);
  await page.getByLabel("Readiness check").selectOption("COV-AUTH-001");
  await expect(page.getByText("Review task · open", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Record change history" }))
    .toContainText("Corrected authorization values agree");
  await capture(page, "14-history");
}

async function captureAnswerAndFamily(page: Page): Promise<void> {
  await page.goto(workspace);
  await page.locator(".sa-patient-screen-header")
    .getByRole("button", { name: "Ask the record", exact: true }).click();
  await capture(page, "15-ask");
  const input = page.getByRole("textbox", { name: "Question about the selected patient" });
  await input.fill("What is missing or conflicting before the visit?");
  await input.press("Enter");
  await expect(page.getByRole("region", { name: "Citation index" })).toBeVisible();
  await capture(page, "16-answer");
  await input.fill("Is it safe to proceed?");
  await input.press("Enter");
  await expect(page.getByRole("button", { name: "Prepare evidence packet for Dr Meera Iyer" }))
    .toBeVisible();
  await expect(page.getByRole("region", { name: "Packet recorded facts" }))
    .toContainText("82000");
  await capture(page, "17-referral");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await section(page, "Family");
  await expect(page.getByRole("region", { name: "Bring before the visit" }))
    .toContainText("Final pathology report");
  await capture(page, "18-family");
}

async function captureRecoveryAndReturn(page: Page): Promise<void> {
  await section(page, "Overview");
  await page.getByRole("button", { name: "Recompute readiness", exact: true }).click();
  await expect(page.locator(".sa-utility-asof")).toContainText("2 Oct 2026");
  await expect(page.getByRole("region", { name: "Overview documents" }))
    .toContainText("Superseded");
  await capture(page, "19-updated-overview");
  await page.goto("/test-daycare");
  await expect(page.getByRole("region", { name: "Visit list" })).toBeVisible();
  await capture(page, "20-restored-worklist");
  await page.goto(workspace);
  await page.route(`**/api/patient/${patientId}`, async (route) => {
    await route.fulfill({ status: 503, contentType: "application/json",
      body: JSON.stringify({ error: "readiness_refresh_unavailable" }) });
  });
  await page.getByRole("button", { name: "Refresh record", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "refresh failed" })).toBeVisible();
  await capture(page, "21-failed-refresh");
  await page.unroute(`**/api/patient/${patientId}`);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(workspace);
  await expect(page.getByRole("region", { name: "Overview documents" }))
    .toContainText("CBC report");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await capture(page, "22-phone");
  await page.goto(`/test-source?known_as_of=${encodeURIComponent(cutoff)}`);
  await capture(page, "22-phone-source");
}
