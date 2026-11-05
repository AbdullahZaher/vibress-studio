import { describe, it, expect } from 'vitest';
import {
  migrateDocument,
  checkDocumentResourceLimits,
  StudioMigrationError,
  isStudioMigrationError,
  isStudioTextNode,
  isStudioHeadingNode,
  isStudioParagraphNode,
  isStudioLinkNode,
  isStudioCardNode,
  StudioHeadingNodeSchema,
  StudioTextNodeSchema,
  StudioLinkNodeSchema,
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
      // Build a deeply nested structure
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
  });

  describe('STU-201: Typed Node Schemas & Guards', () => {
    it('validates text nodes and preserves forward-compatible fields non-destructively', () => {
      const textNode = {
        type: 'text',
        text: 'Hello world',
        format: 1,
        customMark: 'highlight-yellow', // forward-compatible field
      };

      expect(isStudioTextNode(textNode)).toBe(true);
      const parsed = StudioTextNodeSchema.parse(textNode);
      expect(parsed.text).toBe('Hello world');
      expect((parsed as Record<string, unknown>).customMark).toBe('highlight-yellow');
    });

    it('validates heading nodes and rejects invalid tags', () => {
      const validHeading = {
        type: 'heading',
        tag: 'h2',
        children: [{ type: 'text', text: 'Subtitle' }],
      };
      expect(isStudioHeadingNode(validHeading)).toBe(true);
      expect(StudioHeadingNodeSchema.safeParse(validHeading).success).toBe(true);

      const invalidTagHeading = {
        type: 'heading',
        tag: 'h99',
        children: [],
      };
      expect(StudioHeadingNodeSchema.safeParse(invalidTagHeading).success).toBe(false);
    });

    it('identifies links, paragraphs, and studio cards with type guards', () => {
      const pNode = { type: 'paragraph', children: [] };
      const linkNode = { type: 'link', url: 'https://vibress.com', children: [] };
      const cardNode = { type: 'studio-card', cardType: 'callout', cardData: { text: 'Note' } };

      expect(isStudioParagraphNode(pNode)).toBe(true);
      expect(isStudioParagraphNode(linkNode)).toBe(false);

      expect(isStudioLinkNode(linkNode)).toBe(true);
      expect(isStudioLinkNode(pNode)).toBe(false);
      expect(StudioLinkNodeSchema.safeParse(linkNode).success).toBe(true);

      expect(isStudioCardNode(cardNode)).toBe(true);
      expect(isStudioCardNode(pNode)).toBe(false);
    });
  });
});
