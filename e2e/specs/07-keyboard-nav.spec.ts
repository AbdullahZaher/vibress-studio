import { test, expect } from '@playwright/test';
import { openHarness, focusEditor, editorContenteditable, insertCardViaSlash, studio, docCards } from './helpers';

test.describe('Keyboard navigation and focus (E2E 7)', () => {
  test('slash menu opens, arrow keys navigate, Escape closes, focus returns to editor', async ({ page }) => {
    await openHarness(page);
    await focusEditor(page);
    await page.keyboard.type('/');

    const listbox = page.getByRole('listbox', { name: 'Insert card' });
    await expect(listbox).toBeVisible();
    const options = page.getByRole('option');
    const firstCount = await options.count();
    expect(firstCount).toBeGreaterThan(5);

    // ArrowDown moves selection from option 0 to option 1.
    const initialSelected = await page.locator('[role="option"][aria-selected="true"]').textContent();
    await page.keyboard.press('ArrowDown');
    const afterDown = await page.locator('[role="option"][aria-selected="true"]').textContent();
    expect(afterDown).not.toBe(initialSelected);

    // ArrowUp returns to the first option.
    await page.keyboard.press('ArrowUp');
    const afterUp = await page.locator('[role="option"][aria-selected="true"]').textContent();
    expect(afterUp).toBe(initialSelected);

    // Escape closes the menu and focus returns to the editor.
    await page.keyboard.press('Escape');
    await expect(listbox).toHaveCount(0);
    await expect(editorContenteditable(page)).toBeFocused();
  });

  test('Enter in the slash menu inserts the highlighted card', async ({ page }) => {
    await openHarness(page);
    await focusEditor(page);
    await page.keyboard.type('/callout');
    await expect(page.getByRole('option').filter({ hasText: /^Callout$/i })).toBeVisible();
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
    await page.getByRole('option').filter({ hasText: /^toggle$/i }).click();
    await expect(page.locator('.vb-toggle-card')).toBeVisible();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.type('/button');
    await page.getByRole('option').filter({ hasText: /^button$/i }).click();
    await page.locator('.vb-button-card').first().click();
    await expect(page.getByPlaceholder('Add button text')).toBeVisible();
    await expect(page.locator('.vb-button-card input[type="url"]')).toBeVisible();
  });
});
