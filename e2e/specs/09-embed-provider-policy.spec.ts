import { test, expect } from '@playwright/test';
import { openHarness, insertCardViaSlash, studio } from './helpers';

test.describe('Embedded media preview provider allowlist', () => {
  test('unrecognized HTTPS hosts display a safe link, never an iframe', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'embed');
    const api = studio(page);
    await api.setCardField('embed', 'url', 'https://example.org/external');
    const card = page.locator('[data-studio-card="embed"]');
    await expect(card.locator('iframe')).toHaveCount(0);
    const link = card.getByRole('link', { name: 'Open external content' });
    await expect(link).toHaveAttribute('href', 'https://example.org/external');
    await expect(link).toHaveAttribute('rel', /noopener noreferrer/);
  });

  test('unsafe URLs cannot become interactive iframe or link sources', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'embed');
    await studio(page).setCardField('embed', 'url', 'javascript:alert(1)');
    const card = page.locator('[data-studio-card="embed"]');
    await expect(card.locator('iframe')).toHaveCount(0);
    await expect(card.locator('a')).toHaveCount(0);
    await expect(card.getByText('Unsupported or unsafe embed URL.')).toBeVisible();
  });
});
