import { expect, test } from '@playwright/test';

test('test_workspace_when_897px_wide_keeps_patient_context_visible', async ({ page }) => {
  await page.setViewportSize({ width: 897, height: 900 });
  await page.goto('/design-preview/PAT-DC-07');
  await expect(page.getByRole('textbox', { name: 'Find a patient' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Gopal Das PAT-DC-07/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});

test('test_worklist_when_live_unavailable_offers_explicit_recorded_preview', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Patient list unavailable', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Open recorded design preview', exact: true }).click();
  await expect(page).toHaveURL(/\/design-preview\/PAT-DC-04$/);
  await expect(page.getByRole('heading', { name: 'Fatima Begum' })).toBeVisible();
});
