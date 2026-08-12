import { test, expect } from '@playwright/test';
import { openHarness, insertCardViaSlash, studio, docCards } from './helpers';

test.describe('Card edit / remove / retry flows (E2E 3)', () => {
  test('bookmark: valid URL persists through the editor', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'bookmark');
    const input = page.getByLabel('URL');
    await input.fill('https://example.com/article');
    await page.getByRole('button', { name: 'Save' }).click();

    const doc = await studio(page).getDoc();
    const bookmark = docCards(doc).find((c) => c.cardType === 'bookmark');
    expect(bookmark?.cardData.url).toBe('https://example.com/article');
    // The bookmark editor shows the hostname as the title.
    await expect(page.locator('.vb-bookmark-card')).toContainText('example.com');
  });

  test('bookmark: invalid URL shows validation, not a crash', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'bookmark');
    const input = page.getByLabel('URL');
    // A URL that passes native browser validation (type=url) but violates the
    // Studio URL policy must be rejected with a visible validation message.
    await input.fill('javascript:alert(1)');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('alert')).toContainText('not valid');
    const doc = await studio(page).getDoc();
    const bookmark = docCards(doc).find((c) => c.cardType === 'bookmark');
    expect(bookmark?.cardData.url).toBeUndefined();
  });

  test('html card: typed HTML persists to the document', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'html');
    // Card editors expose their controls only while selected.
    const card = page.locator('.vb-html-card');
    await card.click();
    const textarea = page.locator('.vb-html-card textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill('<p>custom</p>');

    const doc = await studio(page).getDoc();
    const htmlCard = docCards(doc).find((c) => c.cardType === 'html');
    expect(htmlCard?.cardData.html).toBe('<p>custom</p>');
  });

  test('button card: label and URL persist', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'button');
    await page.locator('.vb-button-card').first().click();
    const textInput = page.getByPlaceholder('Add button text');
    const urlInput = page.locator('.vb-button-card input[type="url"]');
    await expect(textInput).toBeVisible();
    await textInput.fill('Click me');
    await urlInput.fill('https://example.com/go');
    await page.locator('[data-testid="studio-editor"] [contenteditable="true"]').first().click();

    const doc = await studio(page).getDoc();
    const button = docCards(doc).find((c) => c.cardType === 'button');
    expect(button?.cardData.text).toBe('Click me');
    expect(button?.cardData.url).toBe('https://example.com/go');
  });

  test('card can be removed with the keyboard', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'bookmark');
    await page.getByLabel('URL').fill('https://example.com/remove-me');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('.vb-bookmark-card')).toBeVisible();

    // Click the card to select it, wait for the selection outline (the node
    // selection is re-asserted on the next tick), then press Delete.
    await page.locator('.vb-bookmark-card').click();
    await expect(page.locator('.vb-bookmark-card')).toHaveCSS('outline-color', 'rgb(59, 130, 246)');
    await page.keyboard.press('Delete');

    const doc = await studio(page).getDoc();
    expect(docCards(doc).filter((c) => c.cardType === 'bookmark')).toHaveLength(0);
  });

  test('static divider card is keyboard-selectable and removable', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'divider');
    const card = page.locator('[role="group"][aria-label="divider card"]');
    await expect(card).toBeVisible();
    await card.focus();
    await page.keyboard.press('Enter'); // selects via keyboard
    await page.keyboard.press('Delete'); // removes

    const doc = await studio(page).getDoc();
    expect(docCards(doc).filter((c) => c.cardType === 'divider')).toHaveLength(0);
  });
});
