import { describe, it, expect } from 'vitest';
import {
  migrateDocument,
  checkDocumentResourceLimits,
  resolveResourceLimits,
  getUtf8ByteLength,
  getJsonStringByteLength,
  createDefaultStudioDocument,
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
  StudioParagraphNodeSchema,
  StudioLinkNodeSchema,
  StudioListNodeSchema,
  StudioListItemNodeSchema,
  StudioCodeNodeSchema,
  StudioTableNodeSchema,
  StudioTableRowNodeSchema,
  StudioTableCellNodeSchema,
  StudioCardNodeDataSchema,
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

    it('rejects oversized JSON containing lone surrogates', () => {
      const doc = createDefaultStudioDocument(
        '\uD800'.repeat(900_000)
      );

      const actualSerializedBytes = new TextEncoder().encode(JSON.stringify(doc)).length;
      expect(actualSerializedBytes).toBeGreaterThan(5 * 1024 * 1024);

      expect(() => {
        checkDocumentResourceLimits(doc);
      }).toThrow(StudioMigrationError);
    });

    it('verifies exact JSON UTF-8 byte counting matching TextEncoder + JSON.stringify across edge-case samples', () => {
      const samples = [
        '',
        'Hello World',
        'مرحبا بالعالم',
        '🎉🚀',
        '\uD800',
        '\uDC00',
        '\uD800A',
        'A\uDC00',
        '\uD800\uDC00',
        '"quoted"',
        '\\backslash',
        '\n\t\r\b\f',
        '\u0000',
        '\u0001\u001f',
        '€',
        '\uD800\uD800',
        '\uDC00\uDC00',
        '\uDC00\uD800',
        '\uD800\uDC00\uD800',
        'مرحبا \uD800 مع إيموجي 🎉 و "اقتباس" \\n سطر جديد',
      ];

      for (const sample of samples) {
        const expected = new TextEncoder().encode(JSON.stringify(sample)).length;
        const actual = getJsonStringByteLength(sample);
        expect(actual, `Sample mismatch for "${sample}": expected ${expected}, got ${actual}`).toBe(expected);
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

  describe('STU-201: Typed Node Schemas & Sound Type Guards', () => {
    it('validates text nodes and rejects malformed required and optional inputs', () => {
      const validText = {
        type: 'text',
        text: 'Hello world',
        format: 1,
        customMark: 'highlight-yellow', // forward-compatible field
      };
      expect(isStudioTextNode(validText)).toBe(true);
      expect(isStudioTextNode(validText)).toBe(StudioTextNodeSchema.safeParse(validText).success);

      // Malformed optional field format (string instead of integer)
      const invalidOptional = {
        type: 'text',
        text: 'Hello',
        format: 'invalid',
      };
      expect(isStudioTextNode(invalidOptional)).toBe(false);
      expect(isStudioTextNode(invalidOptional)).toBe(StudioTextNodeSchema.safeParse(invalidOptional).success);

      expect(isStudioTextNode({ type: 'text', text: null })).toBe(false);
      expect(isStudioTextNode({ type: 'text', text: 42 })).toBe(false);
      expect(isStudioTextNode({ type: 'text' })).toBe(false);
      expect(isStudioTextNode(null)).toBe(false);
    });

    it('validates heading nodes and rejects invalid tags, children, and malformed optional fields', () => {
      const validHeading = {
        type: 'heading',
        tag: 'h2',
        children: [{ type: 'text', text: 'Subtitle' }],
      };
      expect(isStudioHeadingNode(validHeading)).toBe(true);
      expect(isStudioHeadingNode(validHeading)).toBe(StudioHeadingNodeSchema.safeParse(validHeading).success);

      // Malformed optional indent
      const invalidIndent = {
        type: 'heading',
        tag: 'h2',
        children: [],
        indent: 'invalid',
      };
      expect(isStudioHeadingNode(invalidIndent)).toBe(false);
      expect(isStudioHeadingNode(invalidIndent)).toBe(StudioHeadingNodeSchema.safeParse(invalidIndent).success);

      expect(isStudioHeadingNode({ type: 'heading', tag: 42, children: [] })).toBe(false);
      expect(isStudioHeadingNode({ type: 'heading', tag: 'h99', children: [] })).toBe(false);
      expect(isStudioHeadingNode({ type: 'heading', tag: 'h2', children: 'invalid' })).toBe(false);
      expect(isStudioHeadingNode({ type: 'heading', tag: 'h2' })).toBe(false);
    });

    it('validates paragraph nodes and rejects non-array children or invalid optional fields', () => {
      const validParagraph = { type: 'paragraph', children: [] };
      expect(isStudioParagraphNode(validParagraph)).toBe(true);
      expect(isStudioParagraphNode(validParagraph)).toBe(StudioParagraphNodeSchema.safeParse(validParagraph).success);

      expect(isStudioParagraphNode({ type: 'paragraph', children: 'invalid' })).toBe(false);
      expect(isStudioParagraphNode({ type: 'paragraph', children: null })).toBe(false);
      expect(isStudioParagraphNode({ type: 'paragraph', children: [], indent: 'invalid' })).toBe(false);
      expect(isStudioParagraphNode({ type: 'paragraph' })).toBe(false);
    });

    it('validates link nodes and rejects invalid url, children, or non-string target/rel', () => {
      const validLink = { type: 'link', url: 'https://vibress.com', children: [] };
      expect(isStudioLinkNode(validLink)).toBe(true);
      expect(isStudioLinkNode(validLink)).toBe(StudioLinkNodeSchema.safeParse(validLink).success);

      // Malformed optional target (number instead of string)
      const invalidTarget = {
        type: 'link',
        url: 'https://example.com',
        children: [],
        target: 123,
      };
      expect(isStudioLinkNode(invalidTarget)).toBe(false);
      expect(isStudioLinkNode(invalidTarget)).toBe(StudioLinkNodeSchema.safeParse(invalidTarget).success);

      expect(isStudioLinkNode({ type: 'link', url: 123, children: [] })).toBe(false);
      expect(isStudioLinkNode({ type: 'link', url: 'https://example.com', children: null })).toBe(false);
      expect(isStudioLinkNode({ type: 'link' })).toBe(false);
    });

    it('validates list and listitem nodes and soundly checks optional fields', () => {
      const validList = { type: 'list', listType: 'bullet', children: [] };
      expect(isStudioListNode(validList)).toBe(true);
      expect(isStudioListNode(validList)).toBe(StudioListNodeSchema.safeParse(validList).success);

      expect(isStudioListNode({ type: 'list', listType: 'invalid', children: [] })).toBe(false);
      expect(isStudioListNode({ type: 'list', listType: 123, children: [] })).toBe(false);
      expect(isStudioListNode({ type: 'list', listType: 'bullet', children: null })).toBe(false);
      expect(isStudioListNode({ type: 'list', listType: 'bullet', children: [], start: 'bad' })).toBe(false);

      const validItem = { type: 'listitem', children: [] };
      expect(isStudioListItemNode(validItem)).toBe(true);
      expect(isStudioListItemNode(validItem)).toBe(StudioListItemNodeSchema.safeParse(validItem).success);
      expect(isStudioListItemNode({ type: 'listitem', children: 'not-array' })).toBe(false);
      expect(isStudioListItemNode({ type: 'listitem', children: [], checked: 'not-boolean' })).toBe(false);
    });

    it('validates code, table, row, and cell nodes and rejects invalid optional numbers', () => {
      expect(isStudioCodeNode({ type: 'code', children: [] })).toBe(true);
      expect(isStudioCodeNode({ type: 'code', children: [], language: 123 })).toBe(false);
      expect(isStudioCodeNode({ type: 'code', children: 'bad' })).toBe(false);
      expect(isStudioCodeNode({ type: 'code', children: [] })).toBe(StudioCodeNodeSchema.safeParse({ type: 'code', children: [] }).success);

      expect(isStudioTableNode({ type: 'table', children: [] })).toBe(true);
      expect(isStudioTableNode({ type: 'table', children: null })).toBe(false);
      expect(isStudioTableNode({ type: 'table', children: [] })).toBe(StudioTableNodeSchema.safeParse({ type: 'table', children: [] }).success);

      expect(isStudioTableRowNode({ type: 'tablerow', children: [] })).toBe(true);
      expect(isStudioTableRowNode({ type: 'tablerow', children: {} })).toBe(false);
      expect(isStudioTableRowNode({ type: 'tablerow', children: [] })).toBe(StudioTableRowNodeSchema.safeParse({ type: 'tablerow', children: [] }).success);

      expect(isStudioTableCellNode({ type: 'tablecell', children: [] })).toBe(true);
      // colSpan: -2 is rejected by positive integer validator
      const invalidColSpan = {
        type: 'tablecell',
        children: [],
        colSpan: -2,
      };
      expect(isStudioTableCellNode(invalidColSpan)).toBe(false);
      expect(isStudioTableCellNode(invalidColSpan)).toBe(StudioTableCellNodeSchema.safeParse(invalidColSpan).success);
      expect(isStudioTableCellNode({ type: 'tablecell', children: 42 })).toBe(false);
    });

    it('validates studio card nodes and rejects malformed card data or invalid versions', () => {
      const validCard = { type: 'studio-card', cardType: 'callout', cardData: { text: 'Note' } };
      expect(isStudioCardNode(validCard)).toBe(true);
      expect(isStudioCardNode(validCard)).toBe(StudioCardNodeDataSchema.safeParse(validCard).success);

      // cardType: 'image', cardData: [], version: 'invalid'
      const invalidCard = {
        type: 'studio-card',
        cardType: 'image',
        cardData: [],
        version: 'invalid',
      };
      expect(isStudioCardNode(invalidCard)).toBe(false);
      expect(isStudioCardNode(invalidCard)).toBe(StudioCardNodeDataSchema.safeParse(invalidCard).success);

      expect(isStudioCardNode({ type: 'studio-card', cardType: '', cardData: {} })).toBe(false);
      expect(isStudioCardNode({ type: 'studio-card', cardType: 123, cardData: {} })).toBe(false);
      expect(isStudioCardNode({ type: 'studio-card', cardType: 'callout', cardData: null })).toBe(false);
      expect(isStudioCardNode({ type: 'studio-card', cardType: 'callout', cardData: 'string' })).toBe(false);
    });

    it('verifies isStudioCardNode requires cardData on the original object while StudioCardNodeDataSchema preserves legacy default', () => {
      const missingCardData = {
        type: 'studio-card',
        cardType: 'image',
      };

      const validCard = {
        type: 'studio-card',
        cardType: 'image',
        cardData: {},
      };

      const invalidCardData = {
        type: 'studio-card',
        cardType: 'image',
        cardData: [],
      };

      const nullCardData = {
        type: 'studio-card',
        cardType: 'image',
        cardData: null,
      };

      expect(isStudioCardNode(missingCardData)).toBe(false);
      expect(isStudioCardNode(validCard)).toBe(true);
      expect(isStudioCardNode(invalidCardData)).toBe(false);
      expect(isStudioCardNode(nullCardData)).toBe(false);

      // StudioCardNodeDataSchema.safeParse continues to succeed for legacy documents
      expect(StudioCardNodeDataSchema.safeParse(missingCardData).success).toBe(true);

      // Forward-compatible fields on card nodes are preserved
      const forwardCompatibleCard = {
        type: 'studio-card',
        cardType: 'image',
        cardData: { src: 'https://example.com/pic.png' },
        extraFutureField: 'future-val',
      };
      expect(isStudioCardNode(forwardCompatibleCard)).toBe(true);
    });

    it('preserves custom resource limits during recursive migration of JSON string documents', () => {
      const largeDoc = {
        schema: 'vibress-studio',
        version: 1,
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Z'.repeat(6 * 1024 * 1024) }], // 6 MB exceeds 5 MB default
            },
          ],
        },
      };

      const jsonStr = JSON.stringify(largeDoc);
      const customLimits = { maxSizeBytes: 8 * 1024 * 1024 };

      // Object migration with custom limit succeeds
      expect(() => migrateDocument(largeDoc, customLimits)).not.toThrow();

      // String migration with custom limit should also succeed, NOT throw RESOURCE_LIMIT_EXCEEDED from default limits!
      expect(() => migrateDocument(jsonStr, customLimits)).not.toThrow();

      // But without custom limits, both fail against 5 MB default
      expect(() => migrateDocument(largeDoc)).toThrow(StudioMigrationError);
      expect(() => migrateDocument(jsonStr)).toThrow(StudioMigrationError);
    });

    it('enforces custom limits below defaults consistently for string and object documents', () => {
      const multiNodeDoc = {
        schema: 'vibress-studio',
        version: 1,
        root: {
          type: 'root',
          children: [
            { type: 'paragraph', children: [{ type: 'text', text: 'One' }] },
            { type: 'paragraph', children: [{ type: 'text', text: 'Two' }] },
            { type: 'paragraph', children: [{ type: 'text', text: 'Three' }] },
          ],
        },
      };

      const jsonStr = JSON.stringify(multiNodeDoc);
      const strictLimits = { maxNodeCount: 3 }; // Total nodes in doc tree is 7, strictly exceeds 3

      expect(() => migrateDocument(multiNodeDoc, strictLimits)).toThrow(StudioMigrationError);
      expect(() => migrateDocument(jsonStr, strictLimits)).toThrow(StudioMigrationError);

      try {
        migrateDocument(jsonStr, strictLimits);
        expect.unreachable();
      } catch (err) {
        expect(isStudioMigrationError(err)).toBe(true);
        const error = err as StudioMigrationError;
        expect(error.code).toBe('RESOURCE_LIMIT_EXCEEDED');
        expect(error.rawDocument).toBe(jsonStr);
      }
    });

    it('migrates legacy documents from JSON strings with custom limits preserved', () => {
      const legacyDoc = {
        root: {
          type: 'root',
          children: [
            { type: 'paragraph', children: [{ type: 'text', text: 'Legacy root' }] },
          ],
        },
      };

      const jsonStr = JSON.stringify(legacyDoc);
      const migrated = migrateDocument(jsonStr, { maxNodeCount: 100 });
      expect(migrated.schema).toBe('vibress-studio');
      expect(migrated.root.children.length).toBe(1);
    });

    it('preserves error classification, recovery context, and original rawDocument for invalid envelopes and unsupported strings', () => {
      // 1. Valid JSON object with invalid schema envelope
      const invalidEnvelopeJson = JSON.stringify({
        schema: 'vibress-studio',
        version: 1,
        root: 'not-an-object',
      });

      try {
        migrateDocument(invalidEnvelopeJson);
        expect.unreachable();
      } catch (err) {
        expect(isStudioMigrationError(err)).toBe(true);
        const error = err as StudioMigrationError;
        expect(error.code).toBe('INVALID_DOCUMENT');
        expect(error.rawDocument).toBe(invalidEnvelopeJson);
      }

      // 2. Unsupported document JSON string
      const unsupportedJson = JSON.stringify({
        unsupportedSchemaProp: 'unknown',
        randomData: [1, 2, 3],
      });

      try {
        migrateDocument(unsupportedJson);
        expect.unreachable();
      } catch (err) {
        expect(isStudioMigrationError(err)).toBe(true);
        const error = err as StudioMigrationError;
        expect(error.code).toBe('UNSUPPORTED_DOCUMENT');
        expect(error.rawDocument).toBe(unsupportedJson);
      }

      // 3. Malformed non-JSON string falls back to default Studio document containing the string
      const malformedJson = '{invalid json syntax';
      const fallbackDoc = migrateDocument(malformedJson);
      expect(fallbackDoc.schema).toBe('vibress-studio');
      const paragraph = fallbackDoc.root.children[0] as { children?: Array<{ text?: string }> };
      expect(paragraph.children?.[0]?.text).toBe(malformedJson);
    });
  });

  describe('non-JSON object serialization safeguards', () => {
    it('rejects a nested custom toJSON without executing it or losing original recovery data', () => {
      let serializeCalls = 0;
      const doc = {
        schema: 'vibress-studio',
        version: 1,
        root: {
          type: 'root',
          children: [{
            type: 'studio-card',
            cardType: 'custom',
            cardData: {
              payload: {
                toJSON() {
                  serializeCalls++;
                  return 'X'.repeat(6 * 1024 * 1024);
                },
              },
            },
          }],
        },
      };
      try {
        checkDocumentResourceLimits(doc, { maxSizeBytes: 1024 });
        expect.unreachable('Custom toJSON should have been rejected');
      } catch (err) {
        expect(isStudioMigrationError(err)).toBe(true);
        expect((err as StudioMigrationError).code).toBe('INVALID_DOCUMENT');
        expect((err as StudioMigrationError).rawDocument).toBe(doc);
        expect(serializeCalls).toBe(0);
      }
    });

    it('rejects custom class instances and accessors instead of evaluating them', () => {
      const document = createDefaultStudioDocument('Safe');
      const root = document.root as { children: unknown[] };
      root.children.push({ type: 'studio-card', cardType: 'custom', cardData: { date: new Date() } });
      expect(() => checkDocumentResourceLimits(document)).toThrow(StudioMigrationError);

      let getterCalls = 0;
      const metadata = Object.defineProperty({}, 'payload', {
        enumerable: true,
        get() { getterCalls++; return 'X'.repeat(6 * 1024 * 1024); },
      });
      const docWithGetter = {
        schema: 'vibress-studio', version: 1,
        root: { type: 'root', children: [{ type: 'studio-card', cardType: 'custom', cardData: metadata }] },
      };
      expect(() => checkDocumentResourceLimits(docWithGetter)).toThrow(StudioMigrationError);
      expect(getterCalls).toBe(0);
    });

    it('continues to accept plain JSON data, including a non-callable toJSON field', () => {
      const document = createDefaultStudioDocument('Safe');
      (document.root.children as unknown[]).push({
        type: 'studio-card',
        cardType: 'custom',
        cardData: { meta: { toJSON: 'stored label', nested: ['ok', null, 2] } },
      });
      expect(() => checkDocumentResourceLimits(document)).not.toThrow();
    });
  });

});
