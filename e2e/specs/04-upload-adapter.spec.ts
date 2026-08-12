import { test, expect } from '@playwright/test';
import { openHarness, focusEditor, insertCardViaSlash, studio, docCards, TEST_IMAGE } from './helpers';

test.describe('Upload adapter mock flow (E2E 4)', () => {
  test('selecting a file uploads and persists the asset URL', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'image');

    await page.locator('[data-testid="studio-editor"] input[type="file"]').setInputFiles(TEST_IMAGE);

    const img = page.locator('.vb-image-card img');
    await expect(img).toHaveAttribute('src', /mock:\/\/asset\/\d+/, { timeout: 10_000 });

    const api = await studio(page);
    expect(await api.adapterName()).toBe('mock');
    const uploads = await api.uploads();
    expect(uploads).toHaveLength(1);
    expect(uploads[0]?.url).toMatch(/^mock:\/\/asset\//);
    expect(uploads[0]?.mimeType).toBe('image/png');

    // The persisted asset metadata is stored on the card.
    const doc = await api.getDoc();
    const image = docCards(doc).find((c) => c.cardType === 'image');
    expect(image?.cardData.src).toMatch(/^mock:\/\/asset\//);
    expect(image?.cardData.assetId).toMatch(/^mock-/);
  });

  test('failed upload surfaces an error overlay; retry succeeds', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'image');

    const api = await studio(page);
    await api.setAdapterFailNext(true);

    await page.locator('[data-testid="studio-editor"] input[type="file"]').setInputFiles(TEST_IMAGE);

    // Error overlay appears (role=alert) with a Retry button.
    await expect(page.getByRole('alert').filter({ hasText: 'Upload failed' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

    await page.getByRole('button', { name: 'Retry' }).click();

    // Retry succeeds: no error overlay, asset persisted.
    await expect(page.locator('.vb-image-card img')).toHaveAttribute('src', /mock:\/\/asset\/\d+/, { timeout: 10_000 });
    await expect(page.getByRole('alert').filter({ hasText: 'Upload failed' })).toHaveCount(0);
    expect(await api.uploads()).toHaveLength(1);
  });

  test('persistent failure can be dismissed without crashing', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'image');

    const api = await studio(page);
    await api.setAdapterFailForever(true);

    await page.locator('[data-testid="studio-editor"] input[type="file"]').setInputFiles(TEST_IMAGE);
    await expect(page.getByRole('alert').filter({ hasText: 'Upload failed' })).toBeVisible();

    await page.getByRole('button', { name: 'Dismiss' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'Upload failed' })).toHaveCount(0);
    // Editor still healthy; the card returns to its unpopulated placeholder.
    await expect(page.getByRole('button', { name: /Add Image/i })).toBeVisible();
    expect((await api.uploads()).length).toBe(0);
  });

  test('video card upload persists via the same adapter', async ({ page }) => {
    await openHarness(page);
    await insertCardViaSlash(page, 'video');
    await page
      .locator('[data-testid="studio-editor"] input[type="file"]')
      .setInputFiles({ name: 'clip.mp4', mimeType: 'video/mp4', buffer: Buffer.from('fake-mp4') });

    await expect(page.locator('.vb-video-card video')).toHaveAttribute('src', /mock:\/\/asset\/\d+/, { timeout: 10_000 });
    const uploads = await studio(page).uploads();
    expect(uploads[0]?.mimeType).toBe('video/mp4');
  });
});
