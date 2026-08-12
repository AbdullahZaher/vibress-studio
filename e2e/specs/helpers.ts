import { test, expect, Page } from '@playwright/test';

/**
 * Shared helpers: the harness page and its window.__studio API.
 */

export interface StudioTestApi {
  getDoc: () => {
    schema: string;
    version: number;
    root: { type: string; children: Array<Record<string, unknown>> };
  };
  uploads: () => Array<{ id: string; url: string; mimeType: string; size: number; alt?: string }>;
  setAdapterFailNext: (v: boolean) => void;
  setAdapterFailForever: (v: boolean) => void;
  adapterName: () => string;
  formatBlock: (type: 'h1' | 'h2' | 'paragraph' | 'bullet' | 'number') => void;
  importHTML: (html: string) => void;
  importMarkdown: (md: string) => void;
  exportMarkdown: () => string;
}

export async function openHarness(page: Page): Promise<void> {
  await page.goto('/e2e.html');
  await expect(page.getByRole('heading', { name: 'Vibress Studio E2E Harness' })).toBeVisible();
  await expect(page.locator('[data-testid="studio-editor"] [contenteditable="true"]')).toBeVisible();
}

/**
 * Proxy to the page's window.__studio API. Each method runs inside the page
 * via page.evaluate (functions cannot be serialized across the boundary).
 */
export function studio(page: Page): StudioTestApi {
  return {
    getDoc: () => page.evaluate(() => (window as unknown as { __studio: StudioTestApi }).__studio.getDoc()),
    uploads: () => page.evaluate(() => (window as unknown as { __studio: StudioTestApi }).__studio.uploads()),
    setAdapterFailNext: (v) => page.evaluate((val) => (window as unknown as { __studio: StudioTestApi }).__studio.setAdapterFailNext(val), v),
    setAdapterFailForever: (v) => page.evaluate((val) => (window as unknown as { __studio: StudioTestApi }).__studio.setAdapterFailForever(val), v),
    adapterName: () => page.evaluate(() => (window as unknown as { __studio: StudioTestApi }).__studio.adapterName()),
    formatBlock: (type) => page.evaluate((t) => (window as unknown as { __studio: StudioTestApi }).__studio.formatBlock(t), type),
    importHTML: (html) => page.evaluate((h) => (window as unknown as { __studio: StudioTestApi }).__studio.importHTML(h), html),
    importMarkdown: (md) => page.evaluate((m) => (window as unknown as { __studio: StudioTestApi }).__studio.importMarkdown(m), md),
    exportMarkdown: () => page.evaluate(() => (window as unknown as { __studio: StudioTestApi }).__studio.exportMarkdown()),
  };
}

export function editorContenteditable(page: Page) {
  return page.locator('[data-testid="studio-editor"] [contenteditable="true"]').first();
}

export async function focusEditor(page: Page): Promise<void> {
  const editable = editorContenteditable(page);
  // Click in the empty space below the content (never on a card) so the
  // editor gains focus with a fresh end-of-document selection.
  const box = (await editable.boundingBox()) ?? { x: 0, y: 0, width: 400, height: 200 };
  await editable.click({
    position: { x: Math.min(80, box.width / 2), y: Math.max(40, box.height - 24) },
  });
}

/** Insert a card via the slash menu (types "/" + name + Enter). */
export async function insertCardViaSlash(page: Page, cardName: string): Promise<void> {
  await focusEditor(page);
  await page.keyboard.type(`/${cardName}`);
  const option = page.getByRole('option').filter({ hasText: new RegExp(`^${cardName}$`, 'i') }).first();
  await expect(option).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Enter');
}

export function docChildTypes(doc: ReturnType<StudioTestApi['getDoc']>): string[] {
  return doc.root.children.map((c) => String(c.type));
}

export function docCards(doc: ReturnType<StudioTestApi['getDoc']>): Array<{ cardType: string; cardData: Record<string, unknown> }> {
  return doc.root.children
    .filter((c) => c.type === 'studio-card')
    .map((c) => ({
      cardType: String(c.cardType),
      cardData: (c.cardData ?? {}) as Record<string, unknown>,
    }));
}

export const TEST_IMAGE = {
  name: 'pixel.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64'
  ),
};
