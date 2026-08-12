import { describe, it, expect } from 'vitest';
import { htmlToStudioDocument } from '@vibress/studio-html';
import { markdownToStudioDocument, studioDocumentToMarkdown } from '@vibress/studio-markdown';
import { renderStudioDocumentToHtml } from '@vibress/studio-renderer';
import { createTestStudioDocument } from '@vibress/studio-testing';
import { XSS_PAYLOADS } from './xss-payloads.test';

/**
 * P6: import/export roundtrips. HTML and markdown must roundtrip through the
 * Studio document model with fidelity and without importing malicious markup.
 */

function rootChildren(doc: { root: { children: unknown[] } }): unknown[] {
  return doc.root.children;
}

describe('HTML import (parse5-based, P6)', () => {
  it('preserves paragraphs, headings, and inline formatting', () => {
    const doc = htmlToStudioDocument('<h1>Title</h1><p><strong>Bold</strong> and <em>italic</em> and <code>code</code></p>');
    const children = rootChildren(doc);
    expect(children[0]).toMatchObject({ type: 'heading', tag: 'h1' });
    const para = children[1] as { children: Array<{ type: string; text?: string; format?: number }> };
    expect(para.type).toBe('paragraph');
    const formats = para.children.map((c) => ({ text: c.text, format: c.format }));
    expect(formats).toContainEqual({ text: 'Bold', format: 1 });
    expect(formats).toContainEqual({ text: 'italic', format: 2 });
    expect(formats).toContainEqual({ text: 'code', format: 16 });
  });

  it('preserves links, quotes, lists, and code blocks', () => {
    const doc = htmlToStudioDocument(`
      <blockquote><p>Quoted</p></blockquote>
      <ul><li>one</li><li>two</li></ul>
      <pre><code>const x = 1;</code></pre>
      <p><a href="https://example.com">link</a></p>
    `);
    const types = rootChildren(doc).map((c) => (c as { type: string }).type);
    expect(types).toContain('quote');
    expect(types).toContain('list');
    expect(types).toContain('code');
    expect(types).toContain('paragraph');
    const linkPara = rootChildren(doc).find((c) => (c as { type: string }).type === 'paragraph') as {
      children: Array<{ type: string; url?: string }>;
    };
    expect(linkPara.children.some((c) => c.type === 'link' && c.url === 'https://example.com')).toBe(true);
  });

  it('imports images and figures as image cards', () => {
    const doc = htmlToStudioDocument('<figure><img src="https://example.com/a.jpg" alt="A"><figcaption>Cap</figcaption></figure>');
    const cards = rootChildren(doc).filter((c) => (c as { type: string }).type === 'studio-card');
    expect(cards.length).toBe(1);
    expect(cards[0]).toMatchObject({ cardType: 'image', cardData: { src: 'https://example.com/a.jpg', alt: 'A', captionHtml: 'Cap' } });
  });

  it('imports horizontal rules as divider cards', () => {
    const doc = htmlToStudioDocument('<p>a</p><hr><p>b</p>');
    const divider = rootChildren(doc).find((c) => (c as { cardType?: string }).cardType === 'divider');
    expect(divider).toBeTruthy();
  });
});

describe('HTML import — malicious input sanitized (P6)', () => {
  it.each(XSS_PAYLOADS)('never imports live markup from payload: %s', (payload) => {
    const doc = htmlToStudioDocument(`<p>ok</p>${payload}<p>end</p>`);
    const html = renderStudioDocumentToHtml(doc);
    expect(html).not.toMatch(/<(script|iframe|object|embed|svg|math|form)\b/i);
    expect(html).not.toContain('javascript:');
    expect(html).not.toMatch(/\son\w+\s*=/i);
  });

  it('strips event handlers and style attributes from imported HTML', () => {
    const doc = htmlToStudioDocument('<p onclick="alert(1)" style="color:red">safe</p>');
    const html = renderStudioDocumentToHtml(doc);
    expect(html).toContain('safe');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('style=');
  });

  it('does not import javascript: links', () => {
    const doc = htmlToStudioDocument('<p><a href="javascript:alert(1)">click</a></p>');
    const html = renderStudioDocumentToHtml(doc);
    expect(html).not.toContain('javascript:');
  });
});

describe('Markdown import (P6)', () => {
  it('parses headings, formatting, links, lists, quotes, code, images, hr', () => {
    const md = [
      '# Title',
      '',
      '**bold** *italic* `code`',
      '',
      '- one',
      '- two',
      '',
      '> quote',
      '',
      '```js',
      'const x = 1;',
      '```',
      '',
      '![Alt](https://example.com/i.png)',
      '',
      '---',
    ].join('\n');
    const doc = markdownToStudioDocument(md);
    const types = rootChildren(doc).map((c) => (c as { type: string }).type);
    expect(types).toContain('heading');
    expect(types).toContain('paragraph');
    expect(types).toContain('list');
    expect(types).toContain('quote');
    expect(types).toContain('code');
    expect(types).toContain('studio-card'); // image + divider
  });

  it('roundtrips markdown → studio → markdown', () => {
    const md = ['# Title', '', 'Paragraph with **bold** and [link](https://example.com).', '', '- item'].join('\n');
    const doc = markdownToStudioDocument(md);
    const out = studioDocumentToMarkdown(doc);
    expect(out).toContain('# Title');
    expect(out).toContain('**bold**');
    expect(out).toContain('[link](https://example.com)');
    expect(out).toContain('- item');
  });
});

describe('Markdown import — malicious input sanitized (P6)', () => {
  it('raw HTML in markdown is disabled', () => {
    const doc = markdownToStudioDocument('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>');
    const html = renderStudioDocumentToHtml(doc);
    // Raw HTML stays literal text (escaped), never a live element.
    expect(html).not.toMatch(/<(script|img)\b/i);
  });

  it('javascript: links are dropped', () => {
    const doc = markdownToStudioDocument('[bad](javascript:alert(1))');
    const html = renderStudioDocumentToHtml(doc);
    // markdown-it refuses unsafe link protocols: no live <a> is produced.
    expect(html).not.toMatch(/<a\b/i);
  });
});

describe('Export — card markdown (P6)', () => {
  it('exports simple cards to native markdown', () => {
    const doc = createTestStudioDocument();
    const md = studioDocumentToMarkdown(doc);
    expect(md).toContain('# Welcome to Vibress Studio');
    expect(md).toContain('![Test Image](https://example.com/test.jpg)');
  });

  it('exports complex cards with the deterministic fence', () => {
    const doc = {
      schema: 'vibress-studio',
      version: 1,
      editor: { lexicalVersion: '0.13.1' },
      root: {
        type: 'root',
        children: [
          {
            type: 'studio-card',
            cardType: 'gallery',
            cardData: { images: [{ src: 'https://example.com/1.jpg', alt: 'one' }] },
            version: 1,
          },
        ],
        version: 1,
      },
    };
    const md = studioDocumentToMarkdown(doc);
    expect(md).toContain('![one](https://example.com/1.jpg)');
  });

  it('html card uses the structured fallback fence', () => {
    const doc = {
      schema: 'vibress-studio',
      version: 1,
      editor: { lexicalVersion: '0.13.1' },
      root: {
        type: 'root',
        children: [
          { type: 'studio-card', cardType: 'html', cardData: { html: '<p>x</p>' }, version: 1 },
        ],
        version: 1,
      },
    };
    const md = studioDocumentToMarkdown(doc);
    expect(md).toContain('::vibress-card{type="html"}');
    expect(md).toContain('"html"');
  });

  it('card fences survive the markdown roundtrip', () => {
    const doc = {
      schema: 'vibress-studio',
      version: 1,
      editor: { lexicalVersion: '0.13.1' },
      root: {
        type: 'root',
        children: [
          {
            type: 'studio-card',
            cardType: 'file',
            cardData: { src: 'https://example.com/f.bin', fileName: 'report.pdf', fileSize: '1.2 MB' },
            version: 1,
          },
        ],
        version: 1,
      },
    };
    const md = studioDocumentToMarkdown(doc);
    const reimported = markdownToStudioDocument(md);
    const card = rootChildren(reimported).find((c) => (c as { cardType?: string }).cardType === 'file') as {
      cardData?: { fileName?: string; src?: string };
    };
    expect(card).toBeTruthy();
    expect(card.cardData?.fileName).toBe('report.pdf');
  });
});

describe('Full roundtrips (P6)', () => {
  it('HTML → Studio → HTML preserves content', () => {
    const html = '<h1>Hello</h1><p><strong>World</strong> <a href="https://example.com">link</a></p>';
    const doc = htmlToStudioDocument(html);
    const out = renderStudioDocumentToHtml(doc);
    expect(out).toContain('<h1>Hello</h1>');
    expect(out).toContain('<strong>World</strong>');
    expect(out).toContain('<a href="https://example.com">link</a>');
  });

  it('Studio → HTML → Studio preserves text content', () => {
    const original = createTestStudioDocument();
    const html = renderStudioDocumentToHtml(original);
    const reimported = htmlToStudioDocument(html);
    const out = renderStudioDocumentToPlainTextSafe(reimported);
    expect(out).toContain('Welcome to Vibress Studio');
    expect(out).toContain('bold');
    expect(out).toContain('italic');
  });

  it('Studio → Markdown → Studio preserves text content', () => {
    const original = createTestStudioDocument();
    const md = studioDocumentToMarkdown(original);
    const reimported = markdownToStudioDocument(md);
    const html = renderStudioDocumentToHtml(reimported);
    expect(html).toContain('Welcome to Vibress Studio');
    expect(html).toContain('<strong>bold</strong>');
  });
});

function renderStudioDocumentToPlainTextSafe(doc: unknown): string {
  // Simple text extraction for assertions (avoids importing the plain-text
  // renderer and duplicating render logic here).
  const text: string[] = [];
  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    const n = node as { type?: string; text?: string; children?: unknown[] };
    if (n.type === 'text' && typeof n.text === 'string') text.push(n.text);
    if (Array.isArray(n.children)) n.children.forEach(walk);
  };
  const root = (doc as { root?: { children?: unknown[] } }).root;
  if (root?.children) root.children.forEach(walk);
  return text.join(' ');
}
