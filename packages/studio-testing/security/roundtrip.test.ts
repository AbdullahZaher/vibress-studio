import { describe, expect, it } from 'vitest';
import { htmlToStudioDocument } from '@vibress/studio-html';
import { studioDocumentToMarkdown } from '@vibress/studio-markdown';
import { renderStudioDocumentToHtml } from '@vibress/studio-renderer';

describe('published content round-trip safety', () => {
  it('preserves bold, italic, and multilingual content without raw script', () => {
    const document = htmlToStudioDocument('<h2>مرحبا World</h2><p><strong>bold</strong> and <em>italic</em></p>');
    const markdown = studioDocumentToMarkdown(document);
    expect(markdown).toContain('## مرحبا World');
    expect(markdown).toContain('**bold**');
    expect(markdown).toContain('*italic*');
    const html = renderStudioDocumentToHtml(document);
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<em>italic</em>');
    expect(html).not.toContain('<script');
  });
});
