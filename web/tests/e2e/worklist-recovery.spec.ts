import { expect, test } from '@playwright/test';

test('test_worklist_when_service_unavailable_does_not_claim_zero_counts', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Visit and patient counts unavailable.', { exact: true }))
    .toBeVisible();
  await expect(page.getByText(/upcoming visits ·/)).toHaveCount(0);
});

test('test_worklist_when_service_unavailable_does_not_claim_successful_refresh', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/^Last attempt /)).toBeVisible();
  await expect(page.getByText(/^Refreshed /)).toHaveCount(0);
});

test('test_worklist_when_service_unavailable_disables_patient_selection', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Select patient', exact: true })).toBeDisabled();
  await expect(page.getByRole('textbox', { name: 'Find a patient', exact: true })).toBeDisabled();
});
