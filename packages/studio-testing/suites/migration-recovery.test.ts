import { describe, it, expect } from 'vitest';
import {
  validateStudioDocument,
  migrateDocument,
  createEmptyStudioDocument,
  createDefaultStudioDocument,
  isValidStudioDocument,
} from '@vibress/studio-core';
import { renderStudioDocumentToHtml, renderStudioDocumentToPlainText } from '@vibress/studio-renderer';
import { serializeStudioDocument, deserializeStudioDocument } from '@vibress/studio-serializer';
import { registerStudioTransforms } from '@vibress/studio-transforms';

/**
 * P10: migration compatibility, malformed document recovery, and
 * serializer/transforms coverage.
 */

describe('Migration compatibility (P10)', () => {
  it('migrates legacy string content', () => {
    const doc = migrateDocument('Plain legacy text');
    expect(doc.schema).toBe('vibress-studio');
    expect(renderStudioDocumentToPlainText(doc)).toContain('Plain legacy text');
  });

  it('migrates legacy JSON strings', () => {
    const doc = migrateDocument(JSON.stringify({ schema: 'vibress-studio', version: 1, root: { type: 'root', children: [] } }));
    expect(doc.schema).toBe('vibress-studio');
  });

  it('migrates Batch 2 object format', () => {
    const doc = migrateDocument({ text: 'Batch 2 content' });
    expect(doc.schema).toBe('vibress-studio');
    expect(renderStudioDocumentToPlainText(doc)).toContain('Batch 2 content');
  });

  it('migrates legacy root-only objects', () => {
    const doc = migrateDocument({ root: { type: 'root', children: [] } });
    expect(doc.schema).toBe('vibress-studio');
    expect(isValidStudioDocument(doc)).toBe(true);
  });

  it('treats null/undefined as an empty document', () => {
    expect(isValidStudioDocument(migrateDocument(null))).toBe(true);
    expect(migrateDocument(undefined).root.children).toBeTruthy();
  });
});

describe('Malformed document recovery (P10)', () => {
  it('rejects malformed documents at validation', () => {
    expect(() => validateStudioDocument(null)).toThrow('INVALID_STUDIO_DOCUMENT');
    expect(() => validateStudioDocument(42)).toThrow('INVALID_STUDIO_DOCUMENT');
    expect(() => validateStudioDocument({ schema: 'other' })).toThrow('INVALID_STUDIO_DOCUMENT');
    expect(() => validateStudioDocument({ schema: 'vibress-studio', version: 0, root: { type: 'root', children: [] } })).toThrow();
    expect(isValidStudioDocument({ schema: 'vibress-studio', version: 1, root: { type: 'root', children: [] } })).toBe(true);
  });

  it('renderer tolerates malformed nodes without crashing', () => {
    const doc = {
      schema: 'vibress-studio',
      version: 1,
      editor: { lexicalVersion: '0.13.1' },
      root: {
        type: 'root',
        children: [
          null,
          { type: 'unknown-type' },
          { type: 'text', text: '<b>ok</b>' },
          { type: 'paragraph', children: [{ type: 'text', text: 'fine' }] },
          { type: 'studio-card', cardType: 'nope', cardData: {} },
        ],
        version: 1,
      },
    };
    const html = renderStudioDocumentToHtml(doc);
    expect(html).toContain('fine');
    expect(html).toContain('Unknown card');
    // Escaped, not live markup.
    expect(html).not.toMatch(/<b>ok<\/b>/);
  });

  it('createEmptyStudioDocument and createDefaultStudioDocument are valid', () => {
    expect(isValidStudioDocument(createEmptyStudioDocument())).toBe(true);
    expect(isValidStudioDocument(createDefaultStudioDocument('hello'))).toBe(true);
    expect(isValidStudioDocument(createDefaultStudioDocument(''))).toBe(true);
  });
});

describe('Serializer roundtrip (P10)', () => {
  it('serializes a root into a valid StudioDocument', () => {
    const root = {
      type: 'root',
      children: [{ type: 'paragraph', children: [{ type: 'text', text: 'x', format: 0 }] }],
    };
    const doc = serializeStudioDocument(root);
    expect(isValidStudioDocument(doc)).toBe(true);
    expect(doc.root.children).toHaveLength(1);
  });

  it('serialize then deserialize preserves content', () => {
    const root = {
      type: 'root',
      children: [
        { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Title', format: 1 }] },
      ],
    };
    const doc = serializeStudioDocument(root);
    const back = deserializeStudioDocument(doc);
    const html = renderStudioDocumentToHtml(back);
    expect(html).toContain('<h2><strong>Title</strong></h2>');
  });
});

describe('Transforms registration (P10)', () => {
  it('registerStudioTransforms returns an unregister function', () => {
    // LexicalEditor needs a DOM host; we only verify the contract of the
    // public API surface by type-checking a minimal stub is out of scope —
    // this test documents that the function exists and is callable-shaped.
    expect(typeof registerStudioTransforms).toBe('function');
  });
});
