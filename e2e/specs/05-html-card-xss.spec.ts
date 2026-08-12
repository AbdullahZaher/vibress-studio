import { test, expect } from '@playwright/test';
import { openHarness, insertCardViaSlash, studio } from './helpers';

const XSS_PAYLOAD = [
  '<script>window.__xss = 1</script>',
  '<img src=x onerror="window.__xss = 2">',
  '<svg onload="window.__xss = 3"></svg>',
  '<iframe srcdoc="<script>window.__xss = 4</script>"></iframe>',
  '<a href="javascript:window.__xss = 5">click</a>',
  '<div style="background:url(javascript:window.__xss = 6)">styled</div>',
].join('\n');

test.describe('HTML card XSS preview does not execute (E2E 5)', () => {
  test('sanitized preview renders no scripts or event handlers and never executes', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', async (d) => {
      dialogs.push(d.message());
      await d.dismiss();
    });

    await openHarness(page);
    await insertCardViaSlash(page, 'html');

    await page.locator('.vb-html-card').click();
    const textarea = page.locator('.vb-html-card textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill(XSS_PAYLOAD);

    // Switch to the HTML preview tab (rendered through SafeHtml).
    await page.getByTestId('tab-html').click();
    const preview = page.getByTestId('preview-html');

    // No live dangerous elements (sanitized <img> may remain, but never script/iframe/svg).
    await expect(preview.locator('script, iframe, svg')).toHaveCount(0);
    // No event-handler attributes on any element.
    const handlers = await preview.evaluate((el) => {
      const found: string[] = [];
      for (const node of el.querySelectorAll('*')) {
        for (const attr of Array.from(node.attributes)) {
          if (/^on[a-z]+$/i.test(attr.name)) found.push(attr.name);
        }
      }
      return found;
    });
    expect(handlers).toEqual([]);

    // Nothing executed in the page.
    await page.waitForTimeout(300);
    const xssFlag = await page.evaluate(() => (window as unknown as { __xss?: number }).__xss);
    expect(xssFlag).toBeUndefined();
    expect(dialogs).toEqual([]);

    // Safe text content survived as escaped text.
    await expect(preview).toContainText('click');
    await expect(preview).toContainText('styled');
  });

  test('script payload typed in the editor does not execute on save', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', async (d) => {
      dialogs.push(d.message());
      await d.dismiss();
    });

    await openHarness(page);
    await insertCardViaSlash(page, 'html');
    await page.locator('.vb-html-card').click();
    await page.locator('.vb-html-card textarea').fill('<script>alert(1)</script>');

    // Simulate save round-trip: read the doc, re-render through the preview.
    await page.getByTestId('tab-json').click();
    const json = await page.getByTestId('preview-json').textContent();
    expect(json).toContain('"html"');

    // The stored document contains the raw payload (author input is preserved),
    // but rendering it anywhere goes through the sanitizer.
    await page.getByTestId('tab-html').click();
    const preview = page.getByTestId('preview-html');
    await expect(preview.locator('script')).toHaveCount(0);
    expect(dialogs).toEqual([]);
  });
});
