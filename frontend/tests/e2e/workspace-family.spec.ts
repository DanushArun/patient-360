import { expect, test } from "@playwright/test";

const patientRoute = "/design-preview/PAT-DC-04#family";

test("test_family_when_language_changes_copies_current_record_without_sending",
  async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(patientRoute);
  const message = page.locator("pre").filter({ hasText: "Fatima Begum" });
  await expect(message).toContainText("PLT is 82000, below threshold 100000");
  await page.getByRole("button", { name: "Copy message", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copied", exact: true })).toBeVisible();
  await page.getByLabel("Family's language").selectOption("hi");
  await expect(page.getByRole("button", { name: "Copy message", exact: true })).toBeVisible();
  await expect(message).toContainText("की विज़िट से पहले");
  await page.getByRole("button", { name: "Copy message", exact: true }).click();
  await expect(page.getByText("Copied to clipboard. No message was sent.", { exact: true }))
    .toHaveCount(1);
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("की विज़िट से पहले");
  expect(copied).toContain("PLT is 82000, below threshold 100000");
  expect(copied).not.toMatch(/proceed with treatment|everything needed|CBC blood test/i);
});

test("test_family_when_clipboard_is_denied_keeps_selectable_message", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", {
    configurable: true, value: { writeText: async () => {
      throw new DOMException("denied", "NotAllowedError");
    } },
  }));
  await page.goto(patientRoute);
  await page.getByRole("button", { name: "Copy message", exact: true }).click();
  await expect(page.getByText("Copy unavailable. Select the message text to copy it.",
    { exact: true })).toBeVisible();
  await expect(page.locator("pre")).toContainText("Fatima Begum");
});

for (const width of [390, 768, 1024, 1440]) {
  test(`test_patient_at_${width}_pixels_keeps_context_and_sections_readable`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/design-preview/PAT-DC-04");
    await expect(page.getByRole("heading", { name: "Fatima Begum" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Patient sections" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({ path: `test-results/screens/patient-${width}.png`,
      fullPage: true });
  });
}
