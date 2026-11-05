import { test, expect } from '@playwright/test';
import { openHarness, focusEditor, editorContenteditable, insertCardViaSlash, studio, docCards } from './helpers';

test.describe('Keyboard navigation and focus (E2E 7)', () => {
  test('slash menu opens, arrow keys navigate, Escape closes, focus returns to editor', async ({ page }) => {
    await openHarness(page);
    await focusEditor(page);
    // Keep the pointer away from options: opening the menu beneath the last
    // editor click can legitimately change selection through onMouseEnter.
    await page.mouse.move(0, 0);
    await page.keyboard.type('/');

    const listbox = page.getByRole('listbox', { name: 'Insert card' });
    await expect(listbox).toBeVisible();
    const options = page.getByRole('option');
    const firstCount = await options.count();
    expect(firstCount).toBeGreaterThan(5);

    // Assert each committed selection before the next key. Immediate textContent
    // snapshots can observe React's preceding render on a busy CI browser.
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(options.first()).toHaveAttribute('aria-selected', 'false');

    await page.keyboard.press('ArrowUp');
    await expect(options.first()).toHaveAttribute('aria-selected', 'true');
    await expect(options.nth(1)).toHaveAttribute('aria-selected', 'false');

    // Escape closes the menu and focus returns to the editor.
    await page.keyboard.press('Escape');
    await expect(listbox).toHaveCount(0);
    await expect(editorContenteditable(page)).toBeFocused();
  });

  test('Enter in the slash menu inserts the highlighted card', async ({ page }) => {
    await openHarness(page);
    await focusEditor(page);
    await page.keyboard.type('/callout');
    await expect(page.getByRole('option', { name: /^Callout$/i })).toBeVisible();
    await page.keyboard.press('Enter');

    const doc = await studio(page).getDoc();
    expect(docCards(doc).map((c) => c.cardType)).toContain('callout');
  });

  test('tab order reaches the URL input and Save button', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'bookmark');

    const input = page.getByLabel('URL');
    await input.focus();
    await expect(input).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Save' })).toBeFocused();
  });

  test('after inserting a card, focus stays in the editor for continued typing', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'divider');
    // Arrow navigation moves past the card into a fresh paragraph.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.type('text after card');
    await expect(editorContenteditable(page)).toContainText('text after card');
  });

  test('card editors expose accessible labels (button, callout, toggle)', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'callout');
    await expect(page.locator('.vb-callout-card')).toBeVisible();

    // Arrow navigation moves past the card into a fresh paragraph.
    await page.keyboard.press('ArrowDown');
    await page.keyboard.type('/toggle');
    await page.getByRole('option', { name: /^toggle$/i }).click();
    await expect(page.locator('.vb-toggle-card')).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.type('/button');
    await page.getByRole('option', { name: /^button$/i }).click();
    await page.locator('.vb-button-card').first().click();
    await expect(page.getByPlaceholder('Add button text')).toBeVisible();
    await expect(page.locator('.vb-button-card input[type="url"]')).toBeVisible();
  });
});
