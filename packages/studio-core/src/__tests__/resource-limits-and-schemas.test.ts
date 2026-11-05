import { describe, it, expect } from 'vitest';
import {
  migrateDocument,
  checkDocumentResourceLimits,
  resolveResourceLimits,
  getUtf8ByteLength,
  StudioMigrationError,
  isStudioMigrationError,
  isStudioTextNode,
  isStudioHeadingNode,
  isStudioParagraphNode,
  isStudioLinkNode,
  isStudioListNode,
  isStudioListItemNode,
  isStudioCodeNode,
  isStudioTableNode,
  isStudioTableRowNode,
  isStudioTableCellNode,
  isStudioCardNode,
  StudioHeadingNodeSchema,
  StudioTextNodeSchema,
  StudioLinkNodeSchema,
  StudioListNodeSchema,
  StudioTableNodeSchema,
} from '../index';

describe('Document Resource Limits & Typed Node Schemas (STU-201, STU-203)', () => {
  describe('STU-203: Resource Limits', () => {
    it('throws RESOURCE_LIMIT_EXCEEDED when string document exceeds maxSizeBytes', () => {
      const largeString = 'A'.repeat(500);

      try {
        migrateDocument(largeString, { maxSizeBytes: 200 });
        expect.unreachable('Should have thrown StudioMigrationError');
      } catch (err) {
        expect(isStudioMigrationError(err)).toBe(true);
        const error = err as StudioMigrationError;
        expect(error.code).toBe('RESOURCE_LIMIT_EXCEEDED');
        expect(error.rawDocument).toBe(largeString);
        expect(error.message).toContain('exceeds maximum allowed limit');
      }
    });

    it('throws RESOURCE_LIMIT_EXCEEDED when JavaScript object document exceeds maxSizeBytes', () => {
      const doc = {
        schema: 'vibress-studio',
        version: 1,
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'X'.repeat(600) }],
            },
          ],
        },
      };

      try {
        checkDocumentResourceLimits(doc, { maxSizeBytes: 300 });
        expect.unreachable('Should have thrown StudioMigrationError for oversized object');
      } catch (err) {
        expect(isStudioMigrationError(err)).toBe(true);
        const error = err as StudioMigrationError;
        expect(error.code).toBe('RESOURCE_LIMIT_EXCEEDED');
        expect(error.rawDocument).toBe(doc);
        expect(error.message).toContain('exceeds maximum allowed limit');
      }
    });

    it('throws RESOURCE_LIMIT_EXCEEDED when cardData metadata contains oversized properties', () => {
      const doc = {
        schema: 'vibress-studio',
        version: 1,
        root: {
          type: 'root',
          children: [
            {
              type: 'studio-card',
              cardType: 'custom',
              cardData: {
                hugePayload: 'B'.repeat(1000),
              },
            },
          ],
        },
      };

      try {
        checkDocumentResourceLimits(doc, { maxSizeBytes: 400 });
        expect.unreachable('Should have thrown StudioMigrationError for oversized card metadata');
      } catch (err) {
        expect(isStudioMigrationError(err)).toBe(true);
        const error = err as StudioMigrationError;
        expect(error.code).toBe('RESOURCE_LIMIT_EXCEEDED');
        expect(error.rawDocument).toBe(doc);
      }
    });

    it('measures byte length in UTF-8 for multibyte characters including Arabic and emoji', () => {
      const arabicWord = 'مرحبا'; // 5 chars, 10 bytes in UTF-8
      expect(arabicWord.length).toBe(5);
      expect(getUtf8ByteLength(arabicWord)).toBe(10);

      const emoji = '🎉🚀'; // 4 UTF-16 code units, 8 bytes in UTF-8
      expect(getUtf8ByteLength(emoji)).toBe(8);

      const doc = {
        schema: 'vibress-studio',
        version: 1,
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'مرحبا بكم في استوديو فايبرس' }],
            },
          ],
        },
      };

      // Exactly calculate object byte size and verify boundary behavior
      const utf8Bytes = getUtf8ByteLength(JSON.stringify(doc));
      expect(() => checkDocumentResourceLimits(doc, { maxSizeBytes: utf8Bytes })).not.toThrow();
      expect(() => checkDocumentResourceLimits(doc, { maxSizeBytes: utf8Bytes - 1 })).toThrowError(/exceeds maximum allowed limit/);
    });

    it('throws RESOURCE_LIMIT_EXCEEDED when node count exceeds maxNodeCount', () => {
      const doc = {
        schema: 'vibress-studio',
        version: 1,
        root: {
          type: 'root',
          children: Array.from({ length: 25 }, (_, i) => ({
            type: 'paragraph',
            children: [{ type: 'text', text: `Paragraph ${i}` }],
          })),
        },
      };

      try {
        checkDocumentResourceLimits(doc, { maxNodeCount: 15 });
        expect.unreachable('Should have thrown StudioMigrationError');
      } catch (err) {
        expect(isStudioMigrationError(err)).toBe(true);
        const error = err as StudioMigrationError;
        expect(error.code).toBe('RESOURCE_LIMIT_EXCEEDED');
        expect(error.message).toContain('node count');
      }
    });

    it('throws RESOURCE_LIMIT_EXCEEDED when nesting depth exceeds maxDepth', () => {
      let deep: Record<string, unknown> = { type: 'text', text: 'deep' };
      for (let i = 0; i < 20; i++) {
        deep = { type: 'paragraph', children: [deep] };
      }
      const doc = {
        schema: 'vibress-studio',
        version: 1,
        root: {
          type: 'root',
          children: [deep],
        },
      };

      try {
        checkDocumentResourceLimits(doc, { maxDepth: 10 });
        expect.unreachable('Should have thrown StudioMigrationError');
      } catch (err) {
        expect(isStudioMigrationError(err)).toBe(true);
        const error = err as StudioMigrationError;
        expect(error.code).toBe('RESOURCE_LIMIT_EXCEEDED');
        expect(error.message).toContain('nesting depth');
      }
    });

    it('detects cyclic object references and throws CORRUPTED_DOCUMENT', () => {
      const cyclicNode: Record<string, unknown> = { type: 'paragraph', children: [] };
      cyclicNode.children = [cyclicNode];
      const doc = {
        schema: 'vibress-studio',
        version: 1,
        root: {
          type: 'root',
          children: [cyclicNode],
        },
      };

      try {
        checkDocumentResourceLimits(doc);
        expect.unreachable('Should have thrown cyclic reference error');
      } catch (err) {
        expect(isStudioMigrationError(err)).toBe(true);
        const error = err as StudioMigrationError;
        expect(error.code).toBe('CORRUPTED_DOCUMENT');
        expect(error.message).toContain('Cyclic reference');
      }
    });

    it('validates limits options and prevents accidental bypass with negative, NaN, or 0 values', () => {
      const resolvedInvalid = resolveResourceLimits({
        maxSizeBytes: -1,
        maxNodeCount: 0,
        maxDepth: NaN,
      });

      expect(resolvedInvalid.maxSizeBytes).toBe(5 * 1024 * 1024);
      expect(resolvedInvalid.maxNodeCount).toBe(50_000);
      expect(resolvedInvalid.maxDepth).toBe(64);

      const resolvedCustom = resolveResourceLimits({
        maxSizeBytes: 2048,
        maxNodeCount: 100,
        maxDepth: 10,
      });

      expect(resolvedCustom.maxSizeBytes).toBe(2048);
      expect(resolvedCustom.maxNodeCount).toBe(100);
      expect(resolvedCustom.maxDepth).toBe(10);
    });

    it('allows valid standard documents within limits', () => {
      const validDoc = {
        schema: 'vibress-studio',
        version: 1,
        editor: { lexicalVersion: '0.13.1' },
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Standard content' }],
            },
          ],
        },
      };

      expect(() => checkDocumentResourceLimits(validDoc)).not.toThrow();
      const migrated = migrateDocument(validDoc);
      expect(migrated.root.children.length).toBe(1);
    });
  });

  describe('STU-201: Typed Node Schemas & Guards', () => {
    it('validates text nodes and rejects malformed inputs', () => {
      const validText = {
        type: 'text',
        text: 'Hello world',
        format: 1,
        customMark: 'highlight-yellow', // forward-compatible field
      };
      expect(isStudioTextNode(validText)).toBe(true);
      const parsed = StudioTextNodeSchema.parse(validText);
      expect(parsed.text).toBe('Hello world');
      expect((parsed as Record<string, unknown>).customMark).toBe('highlight-yellow');

      expect(isStudioTextNode({ type: 'text', text: null })).toBe(false);
      expect(isStudioTextNode({ type: 'text', text: 42 })).toBe(false);
      expect(isStudioTextNode({ type: 'text' })).toBe(false);
      expect(isStudioTextNode(null)).toBe(false);
    });

    it('validates heading nodes and rejects invalid tags or missing children', () => {
      const validHeading = {
        type: 'heading',
        tag: 'h2',
        children: [{ type: 'text', text: 'Subtitle' }],
      };
      expect(isStudioHeadingNode(validHeading)).toBe(true);
      expect(StudioHeadingNodeSchema.safeParse(validHeading).success).toBe(true);

      expect(isStudioHeadingNode({ type: 'heading', tag: 42, children: [] })).toBe(false);
      expect(isStudioHeadingNode({ type: 'heading', tag: 'h99', children: [] })).toBe(false);
      expect(isStudioHeadingNode({ type: 'heading', tag: 'h2', children: 'invalid' })).toBe(false);
      expect(isStudioHeadingNode({ type: 'heading', tag: 'h2' })).toBe(false);
    });

    it('validates paragraph nodes and rejects non-array children', () => {
      const validParagraph = { type: 'paragraph', children: [] };
      expect(isStudioParagraphNode(validParagraph)).toBe(true);

      expect(isStudioParagraphNode({ type: 'paragraph', children: 'invalid' })).toBe(false);
      expect(isStudioParagraphNode({ type: 'paragraph', children: null })).toBe(false);
      expect(isStudioParagraphNode({ type: 'paragraph' })).toBe(false);
    });

    it('validates link nodes and rejects invalid url or children', () => {
      const validLink = { type: 'link', url: 'https://vibress.com', children: [] };
      expect(isStudioLinkNode(validLink)).toBe(true);
      expect(StudioLinkNodeSchema.safeParse(validLink).success).toBe(true);

      expect(isStudioLinkNode({ type: 'link', url: 123, children: [] })).toBe(false);
      expect(isStudioLinkNode({ type: 'link', url: 'https://example.com', children: null })).toBe(false);
      expect(isStudioLinkNode({ type: 'link' })).toBe(false);
    });

    it('validates list and listitem nodes', () => {
      const validList = { type: 'list', listType: 'bullet', children: [] };
      expect(isStudioListNode(validList)).toBe(true);
      expect(StudioListNodeSchema.safeParse(validList).success).toBe(true);

      expect(isStudioListNode({ type: 'list', listType: 'invalid', children: [] })).toBe(false);
      expect(isStudioListNode({ type: 'list', listType: 123, children: [] })).toBe(false);
      expect(isStudioListNode({ type: 'list', listType: 'bullet', children: null })).toBe(false);

      const validItem = { type: 'listitem', children: [] };
      expect(isStudioListItemNode(validItem)).toBe(true);
      expect(isStudioListItemNode({ type: 'listitem', children: 'not-array' })).toBe(false);
    });

    it('validates code, table, row, and cell nodes', () => {
      expect(isStudioCodeNode({ type: 'code', children: [] })).toBe(true);
      expect(isStudioCodeNode({ type: 'code', children: 'bad' })).toBe(false);

      expect(isStudioTableNode({ type: 'table', children: [] })).toBe(true);
      expect(isStudioTableNode({ type: 'table', children: null })).toBe(false);
      expect(StudioTableNodeSchema.safeParse({ type: 'table', children: [] }).success).toBe(true);

      expect(isStudioTableRowNode({ type: 'tablerow', children: [] })).toBe(true);
      expect(isStudioTableRowNode({ type: 'tablerow', children: {} })).toBe(false);

      expect(isStudioTableCellNode({ type: 'tablecell', children: [] })).toBe(true);
      expect(isStudioTableCellNode({ type: 'tablecell', children: 42 })).toBe(false);
    });

    it('validates studio card nodes and rejects malformed card data', () => {
      const validCard = { type: 'studio-card', cardType: 'callout', cardData: { text: 'Note' } };
      expect(isStudioCardNode(validCard)).toBe(true);

      expect(isStudioCardNode({ type: 'studio-card', cardType: '', cardData: {} })).toBe(false);
      expect(isStudioCardNode({ type: 'studio-card', cardType: 123, cardData: {} })).toBe(false);
      expect(isStudioCardNode({ type: 'studio-card', cardType: 'callout', cardData: null })).toBe(false);
      expect(isStudioCardNode({ type: 'studio-card', cardType: 'callout', cardData: 'string' })).toBe(false);
    });
  });
});
