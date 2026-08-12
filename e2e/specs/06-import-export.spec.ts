import { test, expect } from '@playwright/test';
import { openHarness, focusEditor, studio, docChildTypes } from './helpers';

test.describe('Import / export through the UI (E2E 6)', () => {
  test('imports HTML and reflects it in the preview', async ({ page }) => {
    await openHarness(page);
    await page.getByTestId('import-html-input').fill('<h1>Imported Title</h1><p>Body with <strong>bold</strong> and <a href="https://example.com">link</a></p>');
    await page.getByTestId('import-html-btn').click();

    const doc = await studio(page).getDoc();
    const types = docChildTypes(doc);
    expect(types).toContain('heading');
    expect(types).toContain('paragraph');

    await page.getByTestId('tab-html').click();
    const preview = page.getByTestId('preview-html');
    await expect(preview.locator('h1')).toContainText('Imported Title');
    await expect(preview.locator('strong')).toContainText('bold');
    await expect(preview.locator('a')).toHaveAttribute('href', 'https://example.com');
  });

  test('imports markdown with lists and headings', async ({ page }) => {
    await openHarness(page);
    await page.getByTestId('import-md-input').fill('# MD Heading\n\n- item one\n- item two');
    await page.getByTestId('import-md-btn').click();

    const doc = await studio(page).getDoc();
    const types = docChildTypes(doc);
    expect(types).toContain('heading');
    expect(types).toContain('list');

    await page.getByTestId('tab-html').click();
    const preview = page.getByTestId('preview-html');
    await expect(preview.locator('h1')).toContainText('MD Heading');
    await expect(preview.locator('li')).toHaveCount(2);
  });

  test('exports markdown through the UI', async ({ page }) => {
    await openHarness(page);
    await focusEditor(page);
    await page.keyboard.type('Export me');
    await page.keyboard.press('ControlOrMeta+a');
    await page.getByTestId('fmt-h1').click();

    await page.getByTestId('export-md-btn').click();
    await expect(page.getByTestId('export-md-output')).toHaveValue(/# Export me/);
  });

  test('malicious HTML import is sanitized and never executes', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', async (d) => {
      dialogs.push(d.message());
      await d.dismiss();
    });

    await openHarness(page);
    await page.getByTestId('import-html-input').fill('<script>alert(1)</script><p onclick="alert(2)">safe</p><img src=x onerror="alert(3)">');
    await page.getByTestId('import-html-btn').click();

    await page.getByTestId('tab-html').click();
    const preview = page.getByTestId('preview-html');
    await expect(preview.locator('script')).toHaveCount(0);
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
    await expect(preview).toContainText('safe');
    expect(dialogs).toEqual([]);
  });

  test('roundtrip: HTML import → markdown export preserves content', async ({ page }) => {
    await openHarness(page);
    await page.getByTestId('import-html-input').fill('<h2>Roundtrip</h2><p>Stable <em>content</em></p>');
    await page.getByTestId('import-html-btn').click();
    await page.getByTestId('export-md-btn').click();

    await expect(page.getByTestId('export-md-output')).toHaveValue(/## Roundtrip/);
    await expect(page.getByTestId('export-md-output')).toHaveValue(/Stable \*content\*/);
  });
});
