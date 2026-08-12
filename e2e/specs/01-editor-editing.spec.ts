import { test, expect } from '@playwright/test';
import { openHarness, focusEditor, editorContenteditable, studio, docChildTypes } from './helpers';

test.describe('Editor loads and edits (E2E 1)', () => {
  test('editor loads with a focused contenteditable', async ({ page }) => {
    await openHarness(page);
    const editable = editorContenteditable(page);
    await expect(editable).toHaveAttribute('contenteditable', 'true');
    await expect(editable).toHaveAttribute('aria-label', 'Editor content');
  });

  test('types and edits paragraphs', async ({ page }) => {
    await openHarness(page);
    await focusEditor(page);
    await page.keyboard.type('First paragraph.');
    await expect(editorContenteditable(page)).toContainText('First paragraph.');

    await page.keyboard.press('Enter');
    await page.keyboard.type('Second paragraph with ');
    await page.keyboard.press('ControlOrMeta+b');
    await page.keyboard.type('bold');
    await page.keyboard.press('ControlOrMeta+b');
    await page.keyboard.type(' text.');

    const doc = await studio(page).getDoc();
    const types = docChildTypes(doc);
    expect(types.filter((t) => t === 'paragraph').length).toBeGreaterThanOrEqual(2);
    // The bold text has format bitmask 1.
    const boldText = doc.root.children
      .flatMap((c) => (c.children as Array<{ type: string; text?: string; format?: number }>) ?? [])
      .find((t) => t.type === 'text' && t.text === 'bold');
    expect(boldText?.format).toBe(1);
  });

  test('converts selection to a heading via UI', async ({ page }) => {
    await openHarness(page);
    await focusEditor(page);
    await page.keyboard.type('My Heading Text');
    await page.keyboard.press('ControlOrMeta+a');
    await page.getByTestId('fmt-h1').click();

    const doc = await studio(page).getDoc();
    const heading = doc.root.children.find((c) => c.type === 'heading') as
      | { type: string; tag?: string; children?: Array<{ text?: string }> }
      | undefined;
    expect(heading).toBeTruthy();
    expect(heading?.tag).toBe('h1');
    expect(heading?.children?.[0]?.text).toBe('My Heading Text');
  });

  test('creates bullet and numbered lists via UI', async ({ page }) => {
    await openHarness(page);
    await focusEditor(page);
    await page.keyboard.type('alpha');
    await page.keyboard.press('Enter');
    await page.keyboard.type('beta');
    await page.keyboard.press('ControlOrMeta+a');
    await page.getByTestId('fmt-bullet').click();

    let doc = await studio(page).getDoc();
    const list = doc.root.children.find((c) => c.type === 'list') as
      | { listType?: string; children?: Array<{ type?: string }> }
      | undefined;
    expect(list).toBeTruthy();
    expect(list?.listType).toBe('bullet');
    expect(list?.children?.every((c) => c.type === 'listitem')).toBe(true);

    // Numbered list
    await page.getByTestId('btn-reset').click();
    await focusEditor(page);
    await page.keyboard.type('one');
    await page.keyboard.press('Enter');
    await page.keyboard.type('two');
    await page.keyboard.press('ControlOrMeta+a');
    await page.getByTestId('fmt-number').click();

    doc = await studio(page).getDoc();
    const numList = doc.root.children.find((c) => c.type === 'list') as { listType?: string };
    expect(numList?.listType).toBe('number');
  });
});
