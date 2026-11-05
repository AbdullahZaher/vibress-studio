import { test, expect } from '@playwright/test';
import { openHarness, insertCardViaSlash, studio } from './helpers';

test.describe('bookmark persistence and unsafe URLs', () => {
  test('bad persisted bookmark URLs recover without crashing the editor', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'bookmark');
    await studio(page).setCardField('bookmark', 'url', 'javascript:alert(1)');
    const card = page.locator('[data-studio-card="bookmark"]');
    await expect(card.getByText(/Saved bookmark URL is invalid/)).toBeVisible();
    await expect(card.locator('a[href^="javascript:"]')).toHaveCount(0);
    await expect(page.getByText('Studio Error:')).toHaveCount(0);
    await expect(card.getByRole('button', { name: 'Save' })).toBeVisible();
  });
});
