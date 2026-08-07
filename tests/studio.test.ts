import { describe, it, expect } from 'vitest';
import {
  validateStudioDocument,
  migrateDocument,
  createEmptyStudioDocument,
  createDefaultStudioDocument,
} from '@vibress/studio-core';
import { isSafeUrl, sanitizeUrl, sanitizeHtml, escapeHtml } from '@vibress/studio-utils';
import { renderStudioDocumentToHtml, renderStudioDocumentToPlainText } from '@vibress/studio-renderer';
import { htmlToStudioDocument } from '@vibress/studio-html';
import { studioDocumentToMarkdown } from '@vibress/studio-markdown';
import { STUDIO_CARD_DEFINITIONS } from '@vibress/studio-cards';
import { XSS_TEST_PAYLOADS, createTestStudioDocument, createStressTestStudioDocument } from '@vibress/studio-testing';

describe('Vibress Studio Core & Document Validation', () => {
  it('creates valid empty and default studio documents', () => {
    const empty = createEmptyStudioDocument();
    expect(empty.schema).toBe('vibress-studio');
    expect(empty.version).toBe(1);
    expect(validateStudioDocument(empty)).toEqual(empty);

    const def = createDefaultStudioDocument('Hello World');
    expect(def.root.children.length).toBe(1);
  });

  it('migrates legacy string and Batch 2 content correctly', () => {
    const fromText = migrateDocument('Plain text post');
    expect(fromText.schema).toBe('vibress-studio');

    const fromObj = migrateDocument({ text: 'Batch 2 content' });
    expect(fromObj.schema).toBe('vibress-studio');
  });

  it('rejects malformed studio documents', () => {
    expect(() => validateStudioDocument(null)).toThrow('INVALID_STUDIO_DOCUMENT');
    expect(() => validateStudioDocument({ schema: 'wrong-schema' })).toThrow();
  });
});

describe('Vibress Studio Utilities & Security', () => {
  it('validates safe URLs and blocks dangerous protocols', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(isSafeUrl('http://example.com')).toBe(true);
    expect(isSafeUrl('mailto:test@example.com')).toBe(true);
    expect(isSafeUrl('/relative/path')).toBe(true);

    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('vbscript:msgbox')).toBe(false);
  });

  it('sanitizes dangerous HTML and script injections', () => {
    for (const payload of XSS_TEST_PAYLOADS) {
      const clean = sanitizeHtml(payload);
      expect(clean).not.toContain('<script>');
      expect(clean).not.toContain('javascript:');
    }
  });

  it('escapes text properly', () => {
    expect(escapeHtml('<script>alert("1")</script>')).toBe(
      '&lt;script&gt;alert(&quot;1&quot;)&lt;/script&gt;'
    );
  });
});

describe('Vibress Studio Cards', () => {
  it('validates and renders all 14 card types', () => {
    for (const [type, def] of Object.entries(STUDIO_CARD_DEFINITIONS)) {
      expect(def.type).toBe(type);
      expect(def.version).toBe(1);
    }

    const imageCard = STUDIO_CARD_DEFINITIONS.image.renderHtml({
      src: 'https://example.com/img.png',
      alt: 'Alt text',
      caption: 'Caption',
    });
    expect(imageCard).toContain('src="https://example.com/img.png"');
    expect(imageCard).toContain('alt="Alt text"');
  });
});

describe('Vibress Studio Renderer & Markdown', () => {
  it('renders StudioDocument to deterministic HTML', () => {
    const doc = createTestStudioDocument();
    const html = renderStudioDocumentToHtml(doc);
    expect(html).toContain('<h1>Welcome to Vibress Studio</h1>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<img src="https://example.com/test.jpg"');
  });

  it('renders StudioDocument to plain text', () => {
    const doc = createTestStudioDocument();
    const text = renderStudioDocumentToPlainText(doc);
    expect(text).toContain('Welcome to Vibress Studio');
    expect(text).toContain('bold');
  });

  it('converts StudioDocument to Markdown', () => {
    const doc = createTestStudioDocument();
    const md = studioDocumentToMarkdown(doc);
    expect(md).toContain('# Welcome to Vibress Studio');
    expect(md).toContain('**bold**');
  });

  it('converts HTML string to StudioDocument', () => {
    const doc = htmlToStudioDocument('<h1>Title</h1><p>Body text</p>');
    expect(doc.schema).toBe('vibress-studio');
    expect(doc.root.children.length).toBe(2);
  });

  it('handles stress test documents with 200 paragraphs efficiently', () => {
    const stressDoc = createStressTestStudioDocument(200);
    const start = Date.now();
    const html = renderStudioDocumentToHtml(stressDoc);
    const elapsed = Date.now() - start;
    expect(html).toContain('Paragraph 200:');
    expect(elapsed).toBeLessThan(500);
  });
});
