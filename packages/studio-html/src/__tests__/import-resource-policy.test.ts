import { describe, expect, it } from 'vitest';
import { checkDocumentResourceLimits, StudioMigrationError } from '@vibress/studio-core';
import { htmlToStudioDocument } from '../index';

describe('HTML import resource admission', () => {
  it('rejects oversized HTML source before parsing and retains the raw source for recovery', () => {
    const html = '<p>' + '😀'.repeat(2000) + '</p>';
    try {
      htmlToStudioDocument(html, { maxSizeBytes: 500 });
      expect.unreachable('oversized HTML should fail');
    } catch (error) {
      expect(error).toBeInstanceOf(StudioMigrationError);
      if (error instanceof StudioMigrationError) {
        expect(error.code).toBe('RESOURCE_LIMIT_EXCEEDED');
        expect(error.rawDocument).toBe(html);
      }
    }
  });

  it('checks imported AST output limits, not merely HTML input bytes', () => {
    const html = '<p>A</p><p>B</p><p>C</p><p>D</p><p>E</p><p>F</p>';
    expect(() => htmlToStudioDocument(html, { maxNodeCount: 5 }))
      .toThrow(StudioMigrationError);
    const valid = htmlToStudioDocument(html);
    expect(() => checkDocumentResourceLimits(valid)).not.toThrow();
    expect(valid.root.children.length).toBeGreaterThan(0);
  });
});
