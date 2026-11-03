import { describe, it, expect } from 'vitest';
import { htmlToStudioDocument } from '@vibress/studio-html';
import { studioDocumentToMarkdown } from '@vibress/studio-markdown';
import { renderStudioDocumentToHtml } from '@vibress/studio-renderer';

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
