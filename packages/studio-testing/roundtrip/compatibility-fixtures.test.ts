import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrateDocument, StudioMigrationError } from '@vibress/studio-core';
import { serializeStudioDocument } from '@vibress/studio-serializer';
import { STUDIO_CARD_DEFINITIONS } from '@vibress/studio-card-definitions';
import { renderStudioDocumentToHtml, renderStudioDocumentToPlainText } from '@vibress/studio-renderer';
import { sanitizeStudioHtml } from '@vibress/studio-utils';

const fixtures = JSON.parse(readFileSync(join(__dirname, '../fixtures/compatibility-v1.json'), 'utf8'));
describe('versioned publishing fixtures (STU-204/STU-402/STU-901)', () => {
  for (const fixture of fixtures.documents) {
    it(`preserves ${fixture.name} across persisted load/JSON reload`, () => {
      const document = migrateDocument(fixture.input);
      expect(migrateDocument(JSON.stringify(document))).toEqual(document);
      // Future envelope versions remain intact at read boundaries. An editor
      // must refuse to downgrade them; no serialization to v1 is attempted.
      if (document.version === 1) expect(serializeStudioDocument(document.root).root).toEqual(document.root);
      expect(() => renderStudioDocumentToHtml(document)).not.toThrow();
      expect(() => renderStudioDocumentToPlainText(document)).not.toThrow();
    });
  }
  for (const fixture of fixtures.invalid) {
    it(`rejects ${fixture.name} while retaining the original`, () => {
      try { migrateDocument(fixture.input); expect.fail('Invalid fixture must require recovery'); }
      catch (error) {
        expect(error).toBeInstanceOf(StudioMigrationError);
        if (error instanceof StudioMigrationError) expect(error.rawDocument).toBe(fixture.input);
      }
    });
  }
  for (const card of fixtures.cards) {
    it(`validates and safely renders built-in ${card.type}`, () => {
      const definition = STUDIO_CARD_DEFINITIONS[card.type];
      expect(definition).toBeDefined();
      expect(() => definition!.validate(card.data)).not.toThrow();
      const document = { schema: 'vibress-studio', version: 1, root: { type: 'root', children: [
        { type: 'studio-card', version: 1, cardType: card.type, cardData: card.data },
      ] } };
      expect(serializeStudioDocument(migrateDocument(document).root).root).toEqual(document.root);
      expect(renderStudioDocumentToHtml(document)).not.toMatch(/<script|\sonerror=/i);
    });
  }
  for (const node of fixtures.malformedNodes) {
    it(`renders malformed ${node.type} without throwing`, () => {
      const document = { schema: 'vibress-studio', version: 1, root: { type: 'root', children: [node] } };
      expect(() => renderStudioDocumentToHtml(document)).not.toThrow();
      expect(() => renderStudioDocumentToPlainText(document)).not.toThrow();
    });
  }
  it.each(fixtures.securityHtml)('sanitizes independent parser-edge fixture %#', (html) => {
    expect(sanitizeStudioHtml(html)).not.toMatch(/<script|\sonerror=|javascript:/i);
  });
});
