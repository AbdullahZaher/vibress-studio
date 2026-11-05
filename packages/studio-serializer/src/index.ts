import {
  StudioDocument,
  STUDIO_SCHEMA_NAME,
  CURRENT_STUDIO_VERSION,
  validateStudioDocument,
  migrateDocument,
  normalizeStudioDocument,
  checkDocumentResourceLimits,
  type DocumentResourceLimits,
} from '@vibress/studio-core';

export function serializeStudioDocument(root: unknown, limits?: DocumentResourceLimits): StudioDocument {
  const sourceRoot = root && typeof root === 'object' && 'type' in root ? root : { type: 'root', children: [] };
  // Reject cyclic/accessor/oversized structures before recursive normalization.
  checkDocumentResourceLimits(sourceRoot, limits);
  const doc: StudioDocument = {
    schema: STUDIO_SCHEMA_NAME,
    version: CURRENT_STUDIO_VERSION,
    editor: {
      lexicalVersion: '0.13.1',
    },
    // Canonicalization boundary: normalize legacy react-studio-card nodes to
    // studio-card so freshly saved documents only ever persist the canonical
    // representation.
    root: normalizeStudioDocument(
      sourceRoot
    ) as StudioDocument['root'],
  };

  checkDocumentResourceLimits(doc, limits);
  return validateStudioDocument(doc);
}

export function deserializeStudioDocument(input: unknown, limits?: DocumentResourceLimits): StudioDocument {
  return migrateDocument(input, limits);
}
