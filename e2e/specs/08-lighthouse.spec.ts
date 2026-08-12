import { test, expect } from '@playwright/test';
import { chromium } from '@playwright/test';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';

/**
 * Visual accessibility check via Lighthouse against the E2E harness page.
 * Runs headless Chrome through chrome-launcher pointed at the Playwright
 * Chromium build, so color-contrast and other visual audits get a real
 * renderer.
 */

const PAGE_URL = 'http://localhost:5173/e2e.html';

test.describe('Lighthouse accessibility (E2E 8)', () => {
  test('harness page passes accessibility with AA color contrast', async ({ page }) => {
    // Preload the page so the editor is mounted (Lighthouse reloads it anyway).
    await page.goto(PAGE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="studio-editor"] [contenteditable="true"]');

    const chromePath = chromium.executablePath();
    const launcher = await chromeLauncher.launch({
      chromePath,
      chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });

    try {
      const result = await lighthouse(
        PAGE_URL,
        {
          port: launcher.port,
          output: 'json',
          logLevel: 'error',
          onlyCategories: ['accessibility'],
        },
        {
          extends: 'lighthouse:default',
          settings: { onlyCategories: ['accessibility'] },
        }
      );

      const report = result?.lhr;
      expect(report, 'lighthouse produced a report').toBeTruthy();
      const category = report!.categories.accessibility;
      expect(category, 'accessibility category present').toBeTruthy();
      expect(category!.score, `accessibility score (${category!.score})`).toBeGreaterThanOrEqual(0.9);

      const audits = report!.audits;

      // Color contrast must not fail (score 1 = pass, null = n/a, < 1 = fail).
      const contrast = audits['color-contrast'];
      expect(contrast, 'color-contrast audit present').toBeTruthy();
      expect(contrast!.score, `color-contrast score (${contrast!.score})`).not.toBe(0);

      // Core a11y audits pass.
      for (const id of ['document-title', 'html-has-lang', 'button-name', 'label', 'link-name', 'heading-order']) {
        const audit = audits[id];
        expect(audit, `${id} audit present`).toBeTruthy();
        // score 1 = pass; null = not applicable (e.g. no links on the page).
        expect([1, null], `${id} score (${audit!.score})`).toContain(audit!.score);
      }
    } finally {
      await launcher.kill();
    }
  });
});
