import { expect, test } from '@playwright/test';

test('test_authorized_patient_search_when_query_matches_opens_selected_patient',
async ({ page }) => {
  await page.goto('/test-daycare');
  await page.getByRole('button', { name: 'Select patient', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Select an authorized patient' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Search patient name or ID within your care team' })
    .fill('Fatima');
  await expect(dialog.getByRole('radio', { name: /Fatima Begum/ })).toBeChecked();
  await expect(dialog.getByRole('button', { name: 'Open patient' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Open patient' }).click();

  await expect(page).toHaveURL(/\/patient\/PAT-DC-04$/);
});

test('test_authorized_patient_search_when_arrow_down_selects_next_patient',
async ({ page }) => {
  await page.goto('/test-daycare');
  await page.getByRole('button', { name: 'Select patient', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Select an authorized patient' });
  const firstPatient = dialog.getByRole('radio', { name: /Fatima Begum/ });
  await firstPatient.focus();
  await firstPatient.press('ArrowDown');
  await expect(dialog.getByRole('radio', { name: /Gopal Das/ })).toBeChecked();
});

test('test_authorized_patient_search_when_empty_shows_no_match_and_cancel_restores_focus',
async ({ page }) => {
  await page.goto('/test-daycare');
  const trigger = page.getByRole('button', { name: 'Select patient', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Select an authorized patient' });
  const search = dialog.getByRole('textbox', {
    name: 'Search patient name or ID within your care team',
  });
  await search.fill('No such patient');
  await expect(dialog.getByText('No matching patients.', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Open patient' })).toBeDisabled();
  await search.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await expect(dialog.getByRole('textbox', {
    name: 'Search patient name or ID within your care team',
  })).toHaveValue('');
});

test('test_authorized_patient_search_when_roster_unavailable_disables_opening',
async ({ page }) => {
  await page.goto('/test-daycare?roster=unavailable');
  await expect(page.getByRole('button', { name: 'Select patient', exact: true })).toBeDisabled();
});
