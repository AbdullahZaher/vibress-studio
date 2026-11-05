import { describe, expect, it } from 'vitest';
import { getUtf8ByteLength, StudioMigrationError } from '@vibress/studio-core';
import { deserializeStudioDocument, serializeStudioDocument } from '../index';

function sampleRoot(text = 'مرحبا 😀 English') {
  return {
    type: 'root', version: 1,
    children: [{ type: 'paragraph', version: 1,
      children: [{ type: 'text', text, version: 1 }] }],
  };
}

describe('Shared inbound/import/outbound document resource policy', () => {
  it('accepts a serialized document at the exact JSON UTF-8 boundary, rejects it at one byte less', () => {
    const initial = serializeStudioDocument(sampleRoot());
    const bytes = getUtf8ByteLength(JSON.stringify(initial));
    expect(() => serializeStudioDocument(sampleRoot(), { maxSizeBytes: bytes })).not.toThrow();
    expect(() => serializeStudioDocument(sampleRoot(), { maxSizeBytes: bytes - 1 }))
      .toThrow(StudioMigrationError);
    const reloaded = deserializeStudioDocument(initial, { maxSizeBytes: bytes });
    expect(reloaded).toEqual(initial);
  });

  it('rejects excessive card metadata before normalization and preserves the attempted payload', () => {
    const root = {
      type: 'root', children: [{ type: 'studio-card', cardType: 'gallery',
        cardData: { images: [], captionHtml: 'أ'.repeat(1800) }, version: 1 }],
    };
    expect(() => serializeStudioDocument(root, { maxSizeBytes: 512 }))
      .toThrow(StudioMigrationError);
  });

  it('rejects accessors without evaluating them before the outgoing normalizer', () => {
    let reads = 0;
    const metadata: Record<string, unknown> = {};
    Object.defineProperty(metadata, 'secret', {
      enumerable: true,
      get() { reads++; return 'must not execute'; },
    });
    const root = {
      type: 'root', children: [{ type: 'studio-card', cardType: 'image', cardData: metadata }],
    };
    expect(() => serializeStudioDocument(root)).toThrow(StudioMigrationError);
    expect(reads).toBe(0);
  });

  it('rejects excessive AST nesting and node count at outgoing boundary', () => {
    let nested: Record<string, unknown> = { type: 'text', text: 'leaf' };
    for (let i = 0; i < 15; i++) nested = { type: 'paragraph', children: [nested] };
    expect(() => serializeStudioDocument({ type: 'root', children: [nested] }, { maxDepth: 10 }))
      .toThrow(StudioMigrationError);
    const many = { type: 'root',
      children: Array.from({ length: 12 }, () => ({ type: 'paragraph', children: [] })) };
    expect(() => serializeStudioDocument(many, { maxNodeCount: 5 }))
      .toThrow(StudioMigrationError);
  });

});
