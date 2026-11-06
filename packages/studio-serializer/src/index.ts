import {
  StudioDocument,
  STUDIO_SCHEMA_NAME,
  CURRENT_STUDIO_VERSION,
  validateStudioDocument,
  migrateDocument,
  normalizeStudioDocument,
  checkDocumentResourceLimits,
  type DocumentResourceLimits,
  StudioMigrationError,
} from '@vibress/studio-core';

export function serializeStudioDocument(root: unknown, limits?: DocumentResourceLimits, sourceDocument?: StudioDocument): StudioDocument {
  // Inspect descriptors/resources before reading fields or spreading input.
  checkDocumentResourceLimits(root, limits);
  if (sourceDocument) {
    checkDocumentResourceLimits(sourceDocument, limits);
    validateStudioDocument(sourceDocument);
  }
  if (!root || typeof root !== 'object' || !('type' in root) || root.type !== 'root') {
    throw new StudioMigrationError('Cannot serialize an invalid Studio root.', root, 'INVALID_DOCUMENT');
  }
  if (sourceDocument && sourceDocument.version !== CURRENT_STUDIO_VERSION) {
    throw new StudioMigrationError('Cannot downgrade a future Studio document.', sourceDocument, 'UNSUPPORTED_DOCUMENT');
  }
  const sourceRoot = root;
  // Reject cyclic/accessor/oversized structures before recursive normalization.
  const doc: StudioDocument = {
    ...sourceDocument,
    schema: STUDIO_SCHEMA_NAME,
    version: CURRENT_STUDIO_VERSION,
    editor: {
      ...sourceDocument?.editor,
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
