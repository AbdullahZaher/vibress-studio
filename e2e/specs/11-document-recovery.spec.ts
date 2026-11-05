import { test, expect } from '@playwright/test';
import { editorContenteditable, focusEditor, openHarness, studio } from './helpers';

test('invalid host updates pause editing and retain the mounted draft through recovery', async ({ page }, testInfo) => {
  await openHarness(page);
  await focusEditor(page);
  await page.keyboard.insertText('مسودة unsaved draft');
  const editable = editorContenteditable(page);
  await expect(editable).toContainText('مسودة unsaved draft');
  const root = await editable.elementHandle();
  const draft = await studio(page).getDoc();

  await studio(page).syncValue({ schema: 'vibress-studio', version: 1, root: null });

  await expect(page.getByRole('alert')).toContainText('Editing paused');
  await expect(page.locator('[data-testid="studio-editor"] [contenteditable="false"]').first()).toContainText('مسودة unsaved draft');
  expect(await root?.evaluate(element => element.isConnected)).toBe(true);
  expect(await studio(page).getDoc()).toEqual(draft);
  await page.screenshot({ path: testInfo.outputPath('paused-draft.png'), fullPage: true });

  await studio(page).syncValue(draft);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(editable).toContainText('مسودة unsaved draft');
  expect(await root?.evaluate(element => element.isConnected)).toBe(true);
  await editable.focus();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText(' continued');
  await expect(editable).toContainText('مسودة unsaved draft continued');
  await expect.poll(async () => JSON.stringify(await studio(page).getDoc())).toContain('continued');
});
