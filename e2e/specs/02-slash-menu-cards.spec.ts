import { test, expect } from '@playwright/test';
import { openHarness, insertCardViaSlash, studio, docCards } from './helpers';

const BUILT_IN_CARDS = [
  'image',
  'gallery',
  'video',
  'audio',
  'file',
  'bookmark',
  'embed',
  'button',
  'callout',
  'toggle',
  'markdown',
  'html',
  'divider',
] as const;

test.describe('Slash menu inserts every built-in card (E2E 2)', () => {
  for (const card of BUILT_IN_CARDS) {
    test(`inserts ${card} card`, async ({ page }) => {
      await openHarness(page);
      await insertCardViaSlash(page, card);

      const doc = await studio(page).getDoc();
      const cards = docCards(doc);
      expect(cards.map((c) => c.cardType)).toContain(card);
    });
  }

  test('image card shows the file placeholder editor', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'image');
    await expect(page.getByRole('button', { name: /Add Image/i })).toBeVisible();
  });

  test('bookmark card shows the URL placeholder editor', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'bookmark');
    await expect(page.getByText('Paste a URL to add a bookmark')).toBeVisible();
    await expect(page.getByLabel('URL')).toBeVisible();
  });

  test('divider card renders a horizontal rule', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'divider');
    // Static divider card renders <hr /> through the SafeHtml boundary.
    const hr = page.locator('[data-testid="studio-editor"] hr');
    await expect(hr).toHaveCount(1);
  });
});
