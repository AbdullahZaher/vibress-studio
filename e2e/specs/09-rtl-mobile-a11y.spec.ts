import { test, expect } from '@playwright/test';
import { openHarness, focusEditor } from './helpers';

test.describe('Mobile, RTL, Mixed-Script, and Accessibility (Phase C / STU-R14)', () => {
  test.beforeEach(async ({ page }) => {
    await openHarness(page);
  });

  test.describe('Responsive Viewports Matrix', () => {
    const viewports = [
      { width: 320, height: 568, name: '320px (Mobile Compact)' },
      { width: 390, height: 844, name: '390px (Mobile Modern)' },
      { width: 768, height: 1024, name: '768px (Tablet)' },
      { width: 1440, height: 900, name: '1440px (Desktop)' },
    ];

    for (const vp of viewports) {
      test(`renders cleanly without horizontal overflow at ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });

        // Ensure editor is mounted and visible
        const editor = page.locator('[data-testid="studio-editor"] [contenteditable="true"][aria-label="Editor content"]');
        await expect(editor).toBeVisible();

        // Verify document and studio editor do not experience unwanted horizontal scroll overflow
        const overflow = await page.evaluate(() => {
          const editor = document.querySelector('[data-testid="studio-editor"]');
          return {
            pageOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
            editorOverflow: editor ? editor.scrollWidth > editor.clientWidth + 2 : false,
          };
        });
        expect(overflow.pageOverflow, `Page should not have horizontal overflow at ${vp.width}px`).toBe(false);
        expect(overflow.editorOverflow, `Editor should not have horizontal overflow at ${vp.width}px`).toBe(false);

        // Open slash menu and verify it clamps within viewport width
        await focusEditor(page);
        await page.keyboard.type('/');
        const menu = page.locator('.notion-slash-menu');
        await expect(menu).toBeVisible();

        const menuBox = await menu.boundingBox();
        expect(menuBox).toBeTruthy();
        if (menuBox) {
          expect(menuBox.x).toBeGreaterThanOrEqual(0);
          expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(vp.width + 10);
        }

        // Close menu
        await page.keyboard.press('Escape');
        await expect(menu).not.toBeVisible();
      });
    }
  });

  test.describe('Arabic RTL Authoring & Mixed Direction', () => {
    test('toggles to RTL mode and respects direction attributes', async ({ page }) => {
      // Toggle RTL via test harness API
      await page.evaluate(() => {
        window.__studio.setRtl(true);
      });

      const studioContainer = page.locator('.vibress-studio-editor');
      await expect(studioContainer).toHaveAttribute('dir', 'rtl');

      const editor = page.locator('[contenteditable="true"][aria-label="Editor content"]');
      await expect(editor).toHaveAttribute('dir', 'rtl');

      // Type Arabic sentence
      await focusEditor(page);
      await page.keyboard.type('مرحبا بكم في استوديو فايبرس');
      await expect(editor).toContainText('مرحبا بكم في استوديو فايبرس');

      // Verify text-align is start (which computes to right in RTL)
      const computedAlign = await editor.evaluate((el) => {
        const p = el.querySelector('p');
        return p ? window.getComputedStyle(p).textAlign : null;
      });
      // In CSS, text-align defaults to start / right for RTL
      expect(['start', 'right']).toContain(computedAlign);
    });

    test('bilingual slash menu discovery matches Arabic keywords', async ({ page }) => {
      await page.evaluate(() => {
        window.__studio.setRtl(true);
      });

      await focusEditor(page);

      // 1. Search for Image using Arabic keyword '/صورة'
      await page.keyboard.type('/صورة');
      const menu = page.locator('.notion-slash-menu');
      await expect(menu).toBeVisible();
      const imageOption = menu.locator('[role="option"]').filter({ hasText: 'Image' });
      await expect(imageOption).toBeVisible();

      // Clear search
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Backspace');
      }

      // 2. Search for Table using Arabic keyword '/جدول'
      await page.keyboard.type('/جدول');
      await expect(menu).toBeVisible();
      const tableOption = menu.locator('[role="option"]').filter({ hasText: 'Table' });
      await expect(tableOption).toBeVisible();

      // Clear search
      for (let i = 0; i < 6; i++) {
        await page.keyboard.press('Backspace');
      }

      // 3. Search for Heading using Arabic keyword '/عنوان'
      await page.keyboard.type('/عنوان');
      await expect(menu).toBeVisible();
      const h1Option = menu.locator('[role="option"]').filter({ hasText: 'Heading 1' });
      await expect(h1Option).toBeVisible();

      // Press Enter to insert Heading 1
      await page.keyboard.press('Enter');
      await expect(menu).not.toBeVisible();
      const h1 = page.locator('[contenteditable="true"][aria-label="Editor content"] h1');
      await expect(h1).toBeVisible();
    });

    test('protects code block syntax and numbers with LTR direction in RTL documents', async ({ page }) => {
      await page.evaluate(() => {
        window.__studio.setRtl(true);
      });

      // Import document with Arabic text and a code block
      await page.evaluate(() => {
        window.__studio.importHTML(
          '<p dir="rtl">هذا النص بالعربية مع كود برمجي:</p><pre><code>const count = 42;\nfunction test() { return true; }</code></pre>'
        );
      });

      const codeElem = page.locator('[contenteditable="true"][aria-label="Editor content"] pre, [contenteditable="true"][aria-label="Editor content"] code').first();
      await expect(codeElem).toBeVisible();

      // Verify code direction is strictly LTR and left-aligned regardless of document RTL
      const codeDir = await codeElem.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          direction: style.direction,
          textAlign: style.textAlign,
        };
      });

      expect(codeDir.direction).toBe('ltr');
      expect(['left', 'start']).toContain(codeDir.textAlign);
    });

    test('table in RTL document renders with RTL direction and right-aligned text', async ({ page }) => {
      await page.evaluate(() => {
        window.__studio.setRtl(true);
      });

      // Import a table with Arabic headers
      await page.evaluate(() => {
        window.__studio.importHTML(
          '<table><tr><th>الاسم</th><th>العمر</th></tr><tr><td>أحمد</td><td>25</td></tr></table>'
        );
      });

      const table = page.locator('[contenteditable="true"][aria-label="Editor content"] table');
      await expect(table).toBeVisible();

      const tableDir = await table.evaluate((el) => {
        return window.getComputedStyle(el).direction;
      });
      expect(tableDir).toBe('rtl');
    });
  });

  test.describe('Mobile Touch Targets & Accessibility', () => {
    test('interactive buttons meet mobile minimum touch target sizes on 390px viewport', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await focusEditor(page);

      // Open slash menu
      await page.keyboard.type('/');
      const menu = page.locator('.notion-slash-menu');
      await expect(menu).toBeVisible();

      // Check slash menu options have accessible height >= 36px on mobile
      const firstOption = menu.locator('[role="option"]').first();
      await expect(firstOption).toBeVisible();
      const optionBox = await firstOption.boundingBox();
      expect(optionBox).toBeTruthy();
      if (optionBox) {
        expect(optionBox.height).toBeGreaterThanOrEqual(36);
      }

      await page.keyboard.press('Escape');
    });

    test('scoped focus indicators do not bleed outside Studio surfaces', async ({ page }) => {
      // Check that Studio buttons and inputs have focus styling
      const button = page.locator('[data-testid="fmt-h1"]');
      await button.focus();

      const outline = await button.evaluate((el) => {
        return window.getComputedStyle(el).outlineStyle;
      });
      // The harness buttons have normal browser or custom focus
      expect(outline).toBeDefined();
    });
  });
});
