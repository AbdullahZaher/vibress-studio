import { test, expect } from '@playwright/test';
import { editorContenteditable, focusEditor, openHarness, studio } from './helpers';
import { readFileSync } from 'node:fs';

for (const fixture of [
  { name: 'empty object', root: {} },
  { name: 'empty children', root: { children: [] } },
  { name: 'article', root: { children: [{ type: 'paragraph', version: 1, direction: 'rtl', format: '', indent: 0,
    children: [{ type: 'text', version: 1, text: 'مسودة English', format: 1, detail: 0, mode: 'normal', style: '' }] }] } },
]) {
  test(`historical ${fixture.name} root loads, edits and reopens its saved snapshot`, async ({ page }) => {
    await openHarness(page);
    await studio(page).syncValue({ version: 1, root: fixture.root });
    const editable = editorContenteditable(page);
    await expect(editable).toBeVisible();
    if (fixture.name === 'article') await expect(editable).toContainText('مسودة English');
    await editable.locator('p').first().click();
    await page.keyboard.press('ControlOrMeta+End');
    await page.keyboard.insertText(' continued مرحبا');
    await expect.poll(async () => JSON.stringify(await studio(page).getDoc())).toContain('continued مرحبا');
    const saved = await studio(page).getDoc();
    expect(saved.root.type).toBe('root');
    // Native caret placement within bidi text differs across engines. Removing
    // only the new insertion must recover the entire original article text.
    if (fixture.name === 'article') expect(JSON.stringify(saved).replace(' continued مرحبا', '')).toContain('مسودة English');
    await page.reload();
    await expect(editable).toBeVisible();
    await studio(page).syncValue(saved);
    await expect(editable).toContainText('continued مرحبا');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

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

for (const width of [320, 390, 768, 1440]) {
  test(`Arabic dark recovery exports the retained source and draft at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openHarness(page);
    await studio(page).setRecoveryLocale('ar');
    await page.evaluate(() => document.documentElement.classList.add('dark'));
    await expect(page.locator('[data-testid="studio-editor"] .vibress-studio-editor')).toHaveCSS('background-color', 'rgb(9, 10, 15)');
    await focusEditor(page);
    await page.keyboard.insertText('مسودة English محفوظة للاسترداد');
    const original = { schema: 'foreign-editor', version: 99, root: { type: 'root', children: [] } };
    await studio(page).syncValue(original);
    const notice = page.getByRole('alert');
    await expect(notice).toHaveAttribute('dir', 'rtl');
    await expect(notice).toHaveAttribute('lang', 'ar');
    await expect(notice).toContainText('تم إيقاف التحرير مؤقتًا');
    const button = page.getByRole('button', { name: 'تصدير بيانات الاسترداد' });
    expect(await button.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    expect(overflow).toBe(false);
    const downloadPromise = page.waitForEvent('download');
    await button.focus();
    await page.keyboard.press('Enter');
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('studio-recovery.json');
    const path = await download.path();
    expect(path).not.toBeNull();
    const recovered = JSON.parse(readFileSync(path!, 'utf8'));
    expect(recovered.originalValue).toEqual(original);
    expect(JSON.stringify(recovered.editorState)).toContain('مسودة English محفوظة للاسترداد');
    await page.screenshot({ path: testInfo.outputPath('arabic-dark-recovery.png'), fullPage: true });
  });
}
