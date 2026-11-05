import { describe, expect, it } from 'vitest';
import { createDefaultStudioDocument } from '@vibress/studio-core';
import { STUDIO_CARD_DEFINITIONS } from '@vibress/studio-cards';
import { validateCardPayloads } from '../utils/validateCardPayloads';

describe('editable card payload states', () => {
  it.each(Object.keys(STUDIO_CARD_DEFINITIONS))('retains the empty %s authoring state without adding persisted defaults', cardType => {
    const document = createDefaultStudioDocument();
    const cardData = {};
    document.root.children = [{ type: 'studio-card', cardType, cardData }];
    expect(() => validateCardPayloads(document, document)).not.toThrow();
    expect(cardData).toEqual({});
  });

  it.each([
    ['image', { alt: 'Work in progress' }], ['file', { fileName: 'Draft attachment' }],
    ['button', { text: 'Learn more' }], ['toggle', { heading: 'Details' }],
  ])('accepts incomplete %s draft metadata without dropping it', (cardType, cardData) => {
    const document = createDefaultStudioDocument();
    document.root.children = [{ type: 'studio-card', cardType, cardData }];
    expect(() => validateCardPayloads(document, document)).not.toThrow();
  });

  it('still rejects explicitly malformed fields on an incomplete draft', () => {
    const document = createDefaultStudioDocument();
    document.root.children = [{ type: 'studio-card', cardType: 'image', cardData: { alt: 42 } }];
    expect(() => validateCardPayloads(document, document)).toThrow(/invalid image/);
  });
});
