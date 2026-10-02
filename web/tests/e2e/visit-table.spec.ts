import { expect, test } from "@playwright/test";

const fixtureRoute = "/test-daycare";

test("test_visits_when_sorted_keeps_eight_sql_statuses_and_patient_links", async ({ page }) => {
  await page.goto(fixtureRoute);
  await page.screenshot({ path: "../planning/dashboard-release/evidence/daycare-desktop.png",
    fullPage: true });
  await page.getByRole("button", { name: "Visits", exact: true }).click();

  const visitList = page.getByRole("region", { name: "Visit list" });
  const rows = visitList.locator("tbody tr");
  await expect(rows).toHaveCount(8);
  await expect(visitList.getByRole("columnheader", { name: /Date and time/ })).toHaveAttribute(
    "aria-sort", "ascending");
  await expect(visitList.getByText("Blocked", { exact: true })).toHaveCount(2);
  await expect(visitList.getByText("Conflict", { exact: true })).toHaveCount(2);
  await expect(visitList.getByText("Waiting on evidence", { exact: true })).toHaveCount(2);
  await expect(visitList.getByText("Ready · advisory", { exact: true })).toHaveCount(1);
  await expect(visitList.getByText("Ready", { exact: true })).toHaveCount(1);

  await visitList.getByRole("button", { name: "Patient" }).click();
  await expect(rows.first()).toContainText("Anjali Nair");
  await expect(visitList.getByRole("columnheader", { name: /Patient/ })).toHaveAttribute(
    "aria-sort", "ascending");
  await expect(visitList.getByText("Blocked", { exact: true })).toHaveCount(2);

  const patientLink = visitList.getByRole("link", { name: "Fatima Begum" });
  await patientLink.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/patient\/PAT-DC-04$/);
});

test("test_visits_on_mobile_exposes_a_focusable_horizontal_table", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(fixtureRoute);
  await page.getByRole("button", { name: "Visits", exact: true }).click();

  const visitList = page.getByRole("region", { name: "Visit list" });
  await expect(visitList).toBeVisible();
  await expect(visitList.locator("tbody tr")).toHaveCount(8);
  const overflowsHorizontally = await visitList.evaluate((element) =>
    element.scrollWidth > element.clientWidth);
  expect(overflowsHorizontally).toBe(true);
  await visitList.focus();
  await expect(visitList).toBeFocused();
});


test("test_worklist_when_reloaded_restores_date_search_and_view", async ({ page }) => {
  await page.goto(fixtureRoute);
  await page.getByRole("button", { name: "Visits", exact: true }).click();
  await page.getByLabel("Visit date", { exact: true }).selectOption("2026-10-04");
  await page.getByRole("searchbox", { name: "Search day-care visits" }).fill("Fatima");
  await page.reload();
  await expect(page.getByRole("button", { name: "Visits", exact: true }))
    .toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Visit date", { exact: true })).toHaveValue("2026-10-04");
  await expect(page.getByRole("searchbox", { name: "Search day-care visits" }))
    .toHaveValue("Fatima");
  await expect(page.getByRole("region", { name: "Visit list" }).locator("tbody tr"))
    .toHaveCount(1);
});
