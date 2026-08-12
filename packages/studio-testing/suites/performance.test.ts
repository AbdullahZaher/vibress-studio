import { describe, it, expect } from 'vitest';
import { renderStudioDocumentToHtml, renderStudioDocumentToPlainText } from '@vibress/studio-renderer';
import { studioDocumentToMarkdown, markdownToStudioDocument } from '@vibress/studio-markdown';
import { htmlToStudioDocument } from '@vibress/studio-html';
import { createStressTestStudioDocument } from '@vibress/studio-testing';

/**
 * P10: large-document behavior. These are benchmark-style tests: they report
 * timings and assert generous ceilings so regressions are caught without
 * being flaky on slow CI machines.
 */

function timed(label: string, fn: () => unknown): number {
  const start = performance.now();
  fn();
  const elapsed = performance.now() - start;
  console.log(`  [perf] ${label}: ${elapsed.toFixed(1)}ms`);
  return elapsed;
}

describe('Large document performance (P10)', () => {
  it('renders 1,000 paragraphs in bounded time', () => {
    const doc = createStressTestStudioDocument(1000);
    const ms = timed('render 1,000 paragraphs', () => {
      const html = renderStudioDocumentToHtml(doc);
      expect(html).toContain('Paragraph 1000:');
    });
    expect(ms).toBeLessThan(2000);
  });

  it('renders 500 cards in bounded time', () => {
    const children: unknown[] = [];
    for (let i = 0; i < 500; i++) {
      children.push({
        type: 'studio-card',
        cardType: i % 2 === 0 ? 'image' : 'callout',
        cardData:
          i % 2 === 0
            ? { src: `https://example.com/${i}.jpg`, alt: `img ${i}` }
            : { text: `callout ${i}`, emoji: '💡', backgroundColor: 'grey' },
        version: 1,
      });
    }
    const doc = {
      schema: 'vibress-studio',
      version: 1,
      editor: { lexicalVersion: '0.13.1' },
      root: { type: 'root', children, version: 1 },
    };
    const ms = timed('render 500 cards', () => {
      const html = renderStudioDocumentToHtml(doc);
      expect(html).toContain('callout 499');
      expect(html).toContain('https://example.com/498.jpg');
    });
    expect(ms).toBeLessThan(2000);
  });

  it('imports a large HTML document in bounded time', () => {
    const parts = ['<h1>Big</h1>'];
    for (let i = 0; i < 800; i++) {
      parts.push(`<p>Paragraph number <strong>${i}</strong> with some <em>inline</em> content.</p>`);
    }
    const html = parts.join('\n');
    const ms = timed('import large HTML (800 paragraphs)', () => {
      const doc = htmlToStudioDocument(html);
      expect(doc.root.children.length).toBeGreaterThanOrEqual(800);
    });
    expect(ms).toBeLessThan(3000);
  });

  it('exports a large markdown document in bounded time', () => {
    const doc = createStressTestStudioDocument(500);
    const ms = timed('export large markdown (500 paragraphs)', () => {
      const md = studioDocumentToMarkdown(doc);
      expect(md.length).toBeGreaterThan(1000);
    });
    expect(ms).toBeLessThan(2000);
  });

  it('roundtrips a large document (markdown import)', () => {
    const doc = createStressTestStudioDocument(300);
    const md = studioDocumentToMarkdown(doc);
    const ms = timed('import large markdown (300 paragraphs)', () => {
      const reimported = markdownToStudioDocument(md);
      expect(reimported.root.children.length).toBeGreaterThan(100);
    });
    expect(ms).toBeLessThan(3000);
  });

  it('plain-text rendering of a large document stays fast', () => {
    const doc = createStressTestStudioDocument(1000);
    const ms = timed('plain text render 1,000 paragraphs', () => {
      const text = renderStudioDocumentToPlainText(doc);
      expect(text).toContain('Paragraph 1000:');
    });
    expect(ms).toBeLessThan(2000);
  });
});
