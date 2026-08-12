import {
  StudioDocument,
  STUDIO_SCHEMA_NAME,
  CURRENT_STUDIO_VERSION,
  validateStudioDocument,
  migrateDocument,
} from '@vibress/studio-core';

/**
 * The Lexical editor serializes React card nodes as `react-studio-card`
 * (the node type), but the canonical document model stores cards as
 * `studio-card`. Normalize on serialize so stored documents stay canonical
 * and all server renderers/importers only need to handle one type.
 */
function normalizeCardTypes(node: unknown): unknown {
  if (!node || typeof node !== 'object') return node;
  const n = node as Record<string, unknown>;
  if (n.type === 'react-studio-card') {
    n.type = 'studio-card';
  }
  if (Array.isArray(n.children)) {
    n.children = n.children.map(normalizeCardTypes);
  }
  return n;
}

export function serializeStudioDocument(root: unknown): StudioDocument {
  const normalizedRoot = normalizeCardTypes(
    root && typeof root === 'object' && 'type' in root
      ? root
      : { type: 'root', children: [] }
  );

  const doc: StudioDocument = {
    schema: STUDIO_SCHEMA_NAME,
    version: CURRENT_STUDIO_VERSION,
    editor: {
      lexicalVersion: '0.13.1',
    },
    root: normalizedRoot as StudioDocument['root'],
  };

  return validateStudioDocument(doc);
}

export function deserializeStudioDocument(input: unknown): StudioDocument {
  return migrateDocument(input);
}
