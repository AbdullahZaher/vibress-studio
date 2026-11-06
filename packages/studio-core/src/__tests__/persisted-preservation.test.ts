import { describe, expect, it } from 'vitest';
import { assertStudioDocumentEditable, createDefaultStudioDocument, migrateDocument, StudioMigrationError } from '../index';

describe('persisted document compatibility (STU-201/STU-204)', () => {
  it('preserves unknown envelope, editor and node fields during migration', () => {
    const original = {
      ...createDefaultStudioDocument('مرحبا English'),
      publicationMetadata: { important: ['retain', 42] },
      editor: { lexicalVersion: '0.13.1', extensionMetadata: { value: true } },
    };
    expect(migrateDocument(original)).toEqual(original);
    expect(migrateDocument(JSON.stringify(original))).toEqual(original);
  });

  it('never treats a foreign schema with a root as an unversioned legacy document', () => {
    const foreign = { ...createDefaultStudioDocument('foreign content'), schema: 'different-editor' };
    expect(() => migrateDocument(foreign)).toThrow(StudioMigrationError);
  });

  it('honors opt-in string byte limits for text and attributes without truncation', () => {
    const original = createDefaultStudioDocument('مرحبا'.repeat(4));
    expect(() => migrateDocument(original, { maxStringBytes: 24 })).toThrow(StudioMigrationError);
    expect(migrateDocument(original).root).toEqual(original.root);
    const attribute = createDefaultStudioDocument();
    attribute.root.children = [{ type: 'link', url: 'https://example.com/' + 'x'.repeat(200), children: [] }];
    expect(() => migrateDocument(attribute, { maxStringBytes: 100 })).toThrow(StudioMigrationError);
  });

  it.each([NaN, Infinity, BigInt(1), Symbol('value'), () => 'value'])('rejects non-JSON metadata %# before it can be lost on save', value => {
    const original = { ...createDefaultStudioDocument('Keep'), metadata: { value } };
    expect(() => migrateDocument(original)).toThrow(StudioMigrationError);
  });

  it('preserves own __proto__ JSON fields without changing the output prototype', () => {
    const original = JSON.parse('{"schema":"vibress-studio","version":1,"root":{"type":"root","children":[]},"__proto__":{"retain":true}}');
    const migrated = migrateDocument(original);
    expect(JSON.stringify(migrated)).toBe(JSON.stringify(original));
    expect(Object.getPrototypeOf(migrated)).toBe(Object.prototype);
  });

  it.each([
    { type: 'text', text: 'Root cannot contain bare text' },
    { type: 'table', children: [{ type: 'paragraph', children: [] }] },
    { type: 'tablerow', children: [{ type: 'paragraph', children: [] }] },
    { type: 'list', listType: 'bullet', children: [{ type: 'text', text: 'Missing list item' }] },
    { type: 'paragraph', children: [{ type: 'root', children: [] }] },
  ])('rejects structurally invalid $type trees before Lexical import', (node) => {
    const document = createDefaultStudioDocument();
    document.root.children = [node];
    expect(() => assertStudioDocumentEditable(document)).toThrow(StudioMigrationError);
  });
});


it('preserves opaque envelope/editor discriminators while normalizing only root legacy cards', () => {
  const value = {
    ...createDefaultStudioDocument('Keep text'),
    publicationMetadata: { type: 'react-studio-card', custom: 'opaque' },
    editor: { extension: { type: 'react-studio-card', custom: 'opaque editor' } },
  };
  expect(migrateDocument(value)).toEqual(value);
  expect(migrateDocument(JSON.stringify(value))).toEqual(value);
});
