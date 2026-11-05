import { describe, expect, it } from 'vitest';
import { StudioMigrationError } from '@vibress/studio-core';
import { serializeStudioDocument } from '../index';

describe('serialization never substitutes an empty document for invalid content', () => {
  it.each([null, undefined, 'corrupt', [], { children: [] }, { type: 'paragraph', children: [] }])(
    'rejects invalid root %j with recoverable source data', (root) => {
      try {
        serializeStudioDocument(root);
        expect.fail('Invalid roots must not become empty snapshots');
      } catch (error) {
        expect(error).toBeInstanceOf(StudioMigrationError);
        if (error instanceof StudioMigrationError) expect(error.rawDocument).toBe(root);
      }
    }
  );
});
