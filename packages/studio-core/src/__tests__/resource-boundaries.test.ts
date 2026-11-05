import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkDocumentResourceLimits, createDefaultStudioDocument, getUtf8ByteLength, migrateDocument, StudioMigrationError } from '../index';

afterEach(() => vi.unstubAllGlobals());

describe('resource boundary recovery', () => {
  it('keeps UTF-8 byte budgets accurate without a browser TextEncoder', () => {
    const encoder = new TextEncoder();
    const samples = ['ASCII', 'مرحبا', '€', '🚀', '\ud800', '\udc00', '\ud800A'];
    vi.stubGlobal('TextEncoder', undefined);
    for (const sample of samples) expect(getUtf8ByteLength(sample)).toBe(encoder.encode(sample).length);
  });

  it('rejects symbol fields and array getters without evaluating user code', () => {
    let calls = 0;
    const array = Object.defineProperty([], '0', { enumerable: true, get() { calls++; return 'unsafe'; } });
    for (const metadata of [{ [Symbol('hidden')]: 'data' }, array]) {
      const original = { ...createDefaultStudioDocument(), metadata };
      try {
        migrateDocument(original);
        expect.unreachable('Expected recovery');
      } catch (error) {
        expect(error).toBeInstanceOf(StudioMigrationError);
        expect(error).toMatchObject({ code: 'INVALID_DOCUMENT', rawDocument: original });
      }
    }
    expect(calls).toBe(0);
  });

  it('bounds metadata processing even when it contains no document nodes', () => {
    const original = { ...createDefaultStudioDocument(), metadata: Array.from({ length: 100 }, () => false) };
    expect(() => checkDocumentResourceLimits(original, { maxNodeCount: 5 })).toThrow(/complexity/);
  });

  it.each([null, 123456789, false, {}, []])('counts JSON punctuation and primitive payload bytes %#', value => {
    const input = { metadata: value };
    const bytes = new TextEncoder().encode(JSON.stringify(input)).length;
    expect(() => checkDocumentResourceLimits(input, { maxSizeBytes: bytes })).not.toThrow();
    expect(() => checkDocumentResourceLimits(input, { maxSizeBytes: bytes - 1 })).toThrow(StudioMigrationError);
  });
});
