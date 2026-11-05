import { isStudioCardNode, StudioMigrationError, type StudioDocument } from '@vibress/studio-core';
import { STUDIO_CARD_DEFINITIONS } from '@vibress/studio-cards';
import { isDurableMediaUrl } from './mergeDurableMedia';

// Editors intentionally create incomplete cards. Supply view-only defaults for
// required renderer fields during validation; never write them into the source.
const EMPTY_CARD_FIELDS: Record<string, Record<string, unknown>> = {
  image: { src: '' }, gallery: { images: [] }, video: { src: '' }, audio: { src: '' },
  file: { src: '', fileName: '' }, bookmark: { url: '' }, embed: { url: '' },
  button: { text: '', url: '' }, callout: { text: '' }, toggle: { heading: '', content: '' },
  markdown: { markdown: '' }, html: { html: '' }, divider: {},
};

/** Built-in interactive components receive validated shapes, but the original
 * payload is retained: Zod defaults/unknown-field stripping must not rewrite
 * persisted card data. Unregistered cards keep their static preserved form. */
export function validateCardPayloads(document: StudioDocument, original: unknown): void {
  const pending: unknown[] = [...document.root.children];
  while (pending.length) {
    const node = pending.pop();
    if (isStudioCardNode(node) && Object.prototype.hasOwnProperty.call(STUDIO_CARD_DEFINITIONS, node.cardType)) {
      const definition = STUDIO_CARD_DEFINITIONS[node.cardType];
      try {
        definition?.validate({ ...EMPTY_CARD_FIELDS[node.cardType], ...node.cardData });
        if (['image', 'video', 'audio', 'file'].includes(node.cardType) &&
            node.cardData.src !== undefined && node.cardData.src !== '' && !isDurableMediaUrl(node.cardData.src)) throw new Error('Invalid durable media reference');
        if (node.cardType === 'video' && node.cardData.poster && !isDurableMediaUrl(node.cardData.poster)) throw new Error('Invalid poster reference');
        if (node.cardType === 'gallery' && Array.isArray(node.cardData.images)) {
          for (const image of node.cardData.images) {
            if (image && typeof image === 'object' && 'src' in image && !isDurableMediaUrl(image.src)) throw new Error('Invalid gallery reference');
          }
        }
      }
      catch {
        throw new StudioMigrationError(`Cannot safely edit invalid ${node.cardType} card data or media reference.`, original, 'INVALID_DOCUMENT');
      }
    }
    if (node && typeof node === 'object' && 'children' in node && Array.isArray(node.children)) {
      for (const child of node.children) pending.push(child);
    }
  }
}
