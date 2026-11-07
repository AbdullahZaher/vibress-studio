import { describe, it, expect } from 'vitest';
import { htmlToStudioDocument } from '@vibress/studio-html';
import { assertStudioDocumentEditable, migrateDocument } from '@vibress/studio-core';
import { studioDocumentToMarkdown } from '@vibress/studio-markdown';
import { renderStudioDocumentToHtml } from '@vibress/studio-renderer';

describe('HTML alignment import and editable admission', () => {
  it('maps paragraph and RTL heading alignment to Lexical format instead of opaque style', () => {
    const doc = htmlToStudioDocument(
      '<p style="text-align: center">مرحبا English</p>' +
      '<h2 dir="rtl" style="text-align: right">العنوان</h2>'
    );
    expect(doc.root.children).toEqual([
      expect.objectContaining({ type: 'paragraph', format: 'center' }),
      expect.objectContaining({ type: 'heading', direction: 'rtl', format: 'right' }),
    ]);
    expect(() => assertStudioDocumentEditable(doc)).not.toThrow();
    const rendered = renderStudioDocumentToHtml(doc);
    expect(rendered).toContain('style="text-align: center"');
    expect(rendered).toContain('dir="rtl"');
    expect(rendered).toContain('style="text-align: right"');
    const reimported = htmlToStudioDocument(rendered);
    expect(() => assertStudioDocumentEditable(reimported)).not.toThrow();
    expect(reimported.root.children[0]).toMatchObject({ format: 'center' });
  });

  it('publishes canonical alignment on lists, quotes, tables and code blocks', () => {
    const doc = htmlToStudioDocument(
      '<blockquote style="text-align: right">Quote</blockquote>' +
      '<ol style="text-align: center"><li style="text-align: right">One</li></ol>' +
      '<table style="text-align: center"><tr><td>Value</td></tr></table>' +
      '<pre style="text-align: left"><code>demo</code></pre>'
    );
    expect(() => assertStudioDocumentEditable(doc)).not.toThrow();
    const html = renderStudioDocumentToHtml(doc);
    expect(html).toMatch(/<blockquote[^>]*style="text-align: right"/);
    expect(html).toMatch(/<ol[^>]*style="text-align: center"/);
    expect(html).toMatch(/<li[^>]*style="text-align: right"/);
    expect(html).toMatch(/<table[^>]*style="text-align: center"/);
    expect(html).toMatch(/<div class="studio-code-block"[^>]*style="text-align: left"/);
  });

  it('maps table-cell background and alignment into supported fields', () => {
    const doc = htmlToStudioDocument(
      '<table dir="rtl"><tr><td style="background-color: #fff; text-align: center">القيمة</td></tr></table>'
    );
    const cell = (doc.root.children[0] as { children: Array<{ children: Array<Record<string, unknown>> }> }).children[0]!.children[0]!;
    expect(cell).toMatchObject({ backgroundColor: '#fff', format: 'center' });
    expect(() => assertStudioDocumentEditable(doc)).not.toThrow();
    const html = renderStudioDocumentToHtml(doc);
    expect(html).toContain('background-color: #fff');
    expect(html).toContain('text-align: center');
  });

  it('retains valid CSS that Lexical cannot edit in explicit recovery, not a lossy save', () => {
    const doc = htmlToStudioDocument('<p style="color: #aabbcc; text-align: center">Preserve color</p>');
    expect(doc.root.children[0]).toMatchObject({ format: 'center', style: 'color: #aabbcc' });
    expect(migrateDocument(doc)).toEqual(doc);
    expect(() => assertStudioDocumentEditable(doc)).toThrow();
    expect(renderStudioDocumentToHtml(doc)).toContain('color: #aabbcc');
  });

  it('never restores hostile style or event handlers', () => {
    const doc = htmlToStudioDocument('<p onclick="alert(1)" style="background-image: url(javascript:alert(1)); text-align: center">Safe</p>');
    expect(() => assertStudioDocumentEditable(doc)).not.toThrow();
    const html = renderStudioDocumentToHtml(doc);
    expect(html).not.toMatch(/javascript:|onclick|background-image/i);
    expect(html).toContain('text-align: center');
  });
});

describe('sanitized HTML import compatibility', () => {
  it('preserves formatting and Arabic during import and export', () => {
    const doc = htmlToStudioDocument('<h2>العربية English</h2><p>Stable <em>content</em> <strong>bold</strong> <a href="https://example.com">link</a></p>');
    expect(studioDocumentToMarkdown(doc)).toContain('Stable *content*');
    const rendered = renderStudioDocumentToHtml(doc);
    expect(rendered).toContain('<em>content</em>');
    expect(rendered).toContain('العربية English');
    expect(rendered).toContain('href="https://example.com"');
  });

  it('retains semantic unordered lists', () => {
    const doc = htmlToStudioDocument('<h1>Title</h1><ul><li>one</li><li>two</li></ul>');
    expect(doc.root.children).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'list', listType: 'bullet' })]));
    expect(renderStudioDocumentToHtml(doc)).toContain('<li>two</li>');
  });

  it('removes malicious script and event attributes before render', () => {
    const doc = htmlToStudioDocument('<script>alert(1)</script><p onclick="alert(1)">safe</p>');
    const html = renderStudioDocumentToHtml(doc);
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    expect(html).toContain('safe');
  });
});

describe('nested HTML content compatibility', () => {
  it('retains adjacent Arabic/LTR text and inline emphasis inside a div', () => {
    const doc = htmlToStudioDocument('<div dir="rtl">مرحبًا <strong>بالعالم</strong> English <em>text</em></div>');
    expect(doc.root.children).toHaveLength(1);
    const html = renderStudioDocumentToHtml(doc);
    expect(html).toContain('مرحبًا <strong>بالعالم</strong> English <em>text</em>');
    expect(studioDocumentToMarkdown(doc)).toContain('**بالعالم**');
  });

  it('flushes inline runs around nested block elements without dropping text', () => {
    const doc = htmlToStudioDocument('<section>before <b>bold</b><h2>Heading</h2>after <i>italic</i></section>');
    expect(doc.root.children.map(node => (node as {type?: string}).type)).toEqual(['paragraph', 'heading', 'paragraph']);
    const html = renderStudioDocumentToHtml(doc);
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
  });

  it('preserves an inline link and media alt text in a generic wrapper', () => {
    const doc = htmlToStudioDocument('<div>See <a href="https://example.com">the link</a> <img src="/media/p.png" alt="وصف"></div>');
    const html = renderStudioDocumentToHtml(doc);
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('alt="وصف"');
  });
});

describe('HTML table import and RTL round-trip', () => {
  it('retains rows, table headers, colspans, and mixed Arabic content', () => {
    const doc = htmlToStudioDocument(
      '<table dir="rtl"><thead><tr><th colspan="2">الاسم</th></tr></thead>' +
      '<tbody><tr><td>مقال</td><td><strong>10</strong></td></tr></tbody></table>'
    );
    const table = doc.root.children[0] as { type: string; children: Array<{type:string;children:Array<{headerState:number;colSpan:number}>}> };
    expect(table.type).toBe('table');
    expect(table.children).toHaveLength(2);
    expect(table.children[0].type).toBe('tablerow');
    expect(table.children[0].children[0]).toMatchObject({ type: 'tablecell', headerState: 1, colSpan: 2 });
    const html = renderStudioDocumentToHtml(doc);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('<th colspan="2">');
    expect(html).toContain('<strong>10</strong>');
    expect(html).toContain('مقال');
  });

  it('uses a paragraph inside empty cells and preserves safe row spans', () => {
    const doc = htmlToStudioDocument('<table><tr><td rowspan="2"></td><td>one</td></tr><tr><td>two</td></tr></table>');
    const table = doc.root.children[0] as { children: Array<{children: Array<{rowSpan:number;children: Array<{type:string}>}>}> };
    expect(table.children[0].children[0].rowSpan).toBe(2);
    expect(table.children[0].children[0].children[0].type).toBe('paragraph');
    expect(renderStudioDocumentToHtml(doc)).toContain('rowspan="2"');
  });

  it('retains block direction inherited from a div and Arabic text', () => {
    const doc = htmlToStudioDocument('<section dir="rtl"><p>مرحبا English</p><h2>العنوان</h2></section>');
    expect(doc.root.children).toEqual(expect.arrayContaining([expect.objectContaining({direction:'rtl'})]));
    const html = renderStudioDocumentToHtml(doc);
    expect(html).toContain('<p dir="rtl">مرحبا English</p>');
    expect(html).toContain('العنوان');
  });

  it('does not restore executable content in imported table cells', () => {
    const doc = htmlToStudioDocument('<table><tr><td><img src="javascript:alert(1)" onerror="alert(2)">Safe</td></tr></table>');
    const html = renderStudioDocumentToHtml(doc);
    expect(html).not.toMatch(/javascript:|onerror=/i);
    expect(html).toContain('Safe');
  });

  it('imports HTML figure with image and figcaption into image card with caption (STU-R12)', () => {
    const html = '<figure><img src="https://example.com/art.png" alt="Artwork" /><figcaption>Oil painting, 2026</figcaption></figure>';
    const doc = htmlToStudioDocument(html);

    const imageCard = doc.root.children.find(
      (c: unknown) => (c as { type?: string }).type === 'studio-card' && (c as { cardType?: string }).cardType === 'image'
    ) as { type: string; cardType: string; cardData: Record<string, unknown> } | undefined;

    expect(imageCard).toBeDefined();
    expect(imageCard?.cardData.src).toBe('https://example.com/art.png');
    expect(imageCard?.cardData.alt).toBe('Artwork');
    expect(imageCard?.cardData.caption).toBe('Oil painting, 2026');
  });

  it('imports HTML details/summary into toggle card (STU-R12)', () => {
    const html = '<details><summary>Click to view FAQ</summary>Detailed answer text here</details>';
    const doc = htmlToStudioDocument(html);

    const toggleCard = doc.root.children.find(
      (c: unknown) => (c as { type?: string }).type === 'studio-card' && (c as { cardType?: string }).cardType === 'toggle'
    ) as { type: string; cardType: string; cardData: Record<string, unknown> } | undefined;

    expect(toggleCard).toBeDefined();
    expect(toggleCard?.cardData.heading).toBe('Click to view FAQ');
    expect(toggleCard?.cardData.content).toBe('Detailed answer text here');
  });
});
