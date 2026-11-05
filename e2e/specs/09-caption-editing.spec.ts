import { test, expect } from '@playwright/test';
import { openHarness, insertCardViaSlash, studio, docCards, TEST_IMAGE } from './helpers';

test.describe('Stable Media Caption Editing (E2E 9)', () => {
  test('typing into image caption editor does not unmount editor and preserves multi-keystroke text', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'image');

    await page.locator('[data-testid="studio-editor"] input[type="file"]').setInputFiles(TEST_IMAGE);

    const img = page.locator('.vb-image-card img');
    await expect(img).toHaveAttribute('src', /\/mock\/assets\/\d+/, { timeout: 10_000 });

    // The nested caption editor is present
    const captionEditor = page.locator('.vibress-caption-editor [contenteditable="true"]');
    await expect(captionEditor).toBeVisible();

    // Click to focus and type multiple characters
    await captionEditor.click();
    await page.keyboard.type('A majestic sunset over the mountains');

    // The caption editor must STILL be visible and focused (never unmounted or swapped to static figcaption)
    await expect(captionEditor).toBeVisible();
    await expect(captionEditor).toContainText('A majestic sunset over the mountains');
    await expect(page.locator('.vb-image-card figcaption')).toHaveCount(0);

    // Document state should hold the updated caption
    const doc = await studio(page).getDoc();
    const image = docCards(doc).find((c) => c.cardType === 'image');
    expect(image?.cardData.captionHtml).toContain('A majestic sunset over the mountains');
  });

  test('caption undo works via keyboard inside nested editor', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'image');

    await page.locator('[data-testid="studio-editor"] input[type="file"]').setInputFiles(TEST_IMAGE);
    await expect(page.locator('.vb-image-card img')).toHaveAttribute('src', /\/mock\/assets\/\d+/, { timeout: 10_000 });

    const captionEditor = page.locator('.vibress-caption-editor [contenteditable="true"]');
    await captionEditor.click();
    await page.keyboard.type('Initial draft');
    await expect(captionEditor).toContainText('Initial draft');

    // Wait past Lexical HistoryPlugin merge delay so subsequent keystrokes form a distinct undo state
    await page.waitForTimeout(1100);

    await page.keyboard.type(' and typo');
    await expect(captionEditor).toContainText('Initial draft and typo');

    await page.keyboard.press('ControlOrMeta+z');
    await expect(captionEditor).toContainText('Initial draft');

    // Redo restores the text
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(captionEditor).toContainText('Initial draft and typo');
  });

  test('card loaded with pre-existing caption allows continuous editing', async ({ page }) => {
    await openHarness(page);
    const api = studio(page);
    await insertCardViaSlash(page, 'image');
    await page.locator('[data-testid="studio-editor"] input[type="file"]').setInputFiles(TEST_IMAGE);
    await expect(page.locator('.vb-image-card img')).toHaveAttribute('src', /\/mock\/assets\/\d+/, { timeout: 10_000 });

    // Update caption via API to simulate loading an existing document or popover update
    await api.setCardField('image', 'captionHtml', '<p>Loaded from disk</p>');

    const captionEditor = page.locator('.vibress-caption-editor [contenteditable="true"]');
    await expect(captionEditor).toBeVisible();
    await expect(captionEditor).toContainText('Loaded from disk');

    // Focus and append text
    await captionEditor.click();
    // Clicking an existing caption places the caret at the click position.
    // Move it to the end before testing the explicit append workflow.
    await captionEditor.press('End');
    await page.keyboard.type(' - appended note');

    await expect(captionEditor).toContainText('Loaded from disk - appended note');
    await expect(page.locator('.vb-image-card figcaption')).toHaveCount(0);
  });
});
