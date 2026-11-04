import { describe, it, expect } from 'vitest';
import {
  migrateDocument,
  StudioMigrationError,
  isStudioMigrationError,
  LEGACY_CARD_NODE_TYPE,
  CANONICAL_CARD_NODE_TYPE,
} from '../index';

describe('Safe document migration and recovery (STU-R01)', () => {
  it('distinguishes genuinely absent input from invalid documents', () => {
    // Genuinely absent input returns an empty Studio document
    const emptyFromUndefined = migrateDocument(undefined);
    expect(emptyFromUndefined.schema).toBe('vibress-studio');
    expect(emptyFromUndefined.version).toBe(1);
    expect(emptyFromUndefined.root.children.length).toBe(1);

    const emptyFromNull = migrateDocument(null);
    expect(emptyFromNull.schema).toBe('vibress-studio');

    const emptyFromString = migrateDocument('');
    expect(emptyFromString.schema).toBe('vibress-studio');

    const emptyFromWhitespace = migrateDocument('   \n  ');
    expect(emptyFromWhitespace.schema).toBe('vibress-studio');
  });

  it('rejects unsupported persisted object and throws StudioMigrationError', () => {
    const corruptObject = { foo: 'bar', randomProp: 123 };
    expect(() => migrateDocument(corruptObject)).toThrow(StudioMigrationError);

    try {
      migrateDocument(corruptObject);
    } catch (err) {
      expect(isStudioMigrationError(err)).toBe(true);
      if (err instanceof StudioMigrationError) {
        expect(err.code).toBe('UNSUPPORTED_DOCUMENT');
        expect(err.rawDocument).toBe(corruptObject);
      }
    }
  });

  it('rejects invalid vibress-studio document and preserves raw document in error', () => {
    const invalidDoc = {
      schema: 'vibress-studio',
      version: 1,
      root: null, // invalid root
    };

    expect(() => migrateDocument(invalidDoc)).toThrow(StudioMigrationError);

    try {
      migrateDocument(invalidDoc);
    } catch (err) {
      expect(isStudioMigrationError(err)).toBe(true);
      if (err instanceof StudioMigrationError) {
        expect(err.code).toBe('INVALID_DOCUMENT');
        expect(err.rawDocument).toBe(invalidDoc);
      }
    }
  });

  it('rejects arrays or unexpected primitive types as unsupported documents', () => {
    expect(() => migrateDocument([1, 2, 3])).toThrow(StudioMigrationError);
    expect(() => migrateDocument(12345)).toThrow(StudioMigrationError);
    expect(() => migrateDocument(false)).toThrow(StudioMigrationError);
  });

  it('preserves unknown forward-compatible nodes in valid Studio documents', () => {
    const futureDoc = {
      schema: 'vibress-studio',
      version: 2,
      editor: { lexicalVersion: '0.14.0' },
      root: {
        type: 'root',
        children: [
          {
            type: 'custom-future-card',
            futureProp: 'important data',
            version: 1,
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    };

    const migrated = migrateDocument(futureDoc);
    expect(migrated.version).toBe(2);
    expect(migrated.root.children.length).toBe(1);
    const firstChild = migrated.root.children[0] as Record<string, unknown>;
    expect(firstChild.type).toBe('custom-future-card');
    expect(firstChild.futureProp).toBe('important data');
  });

  it('preserves legacy card normalization and Batch 2 legacy formats', () => {
    // Legacy card node
    const legacyCardDoc = {
      schema: 'vibress-studio',
      version: 1,
      root: {
        type: 'root',
        children: [
          {
            type: LEGACY_CARD_NODE_TYPE,
            cardType: 'image',
            cardData: { src: 'https://example.com/img.png', alt: 'Test' },
            version: 1,
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    };

    const migrated = migrateDocument(legacyCardDoc);
    const legacyChild = migrated.root.children[0] as Record<string, unknown>;
    expect(legacyChild.type).toBe(CANONICAL_CARD_NODE_TYPE);

    // Plain text legacy string
    const textMigrated = migrateDocument('Plain text article');
    expect(textMigrated.schema).toBe('vibress-studio');
    expect(textMigrated.root.children.length).toBe(1);

    // Legacy Batch 2 object with text
    const batch2Obj = migrateDocument({ text: 'Batch 2 article' });
    expect(batch2Obj.schema).toBe('vibress-studio');

    // Legacy Batch 2 object with root but without schema envelope
    const batch2Root = migrateDocument({
      root: {
        type: 'root',
        children: [{ type: 'paragraph', children: [], direction: null, format: '', indent: 0, version: 1 }],
      },
    });
    expect(batch2Root.schema).toBe('vibress-studio');
    expect(batch2Root.version).toBe(1);
  });
});
