import { z } from 'zod';

export const STUDIO_SCHEMA_NAME = 'vibress-studio';
export const CURRENT_STUDIO_VERSION = 1;

export interface StudioDocument {
  schema: 'vibress-studio';
  version: number;
  editor?: {
    lexicalVersion?: string;
  };
  root: {
    type: 'root';
    children: unknown[];
    [key: string]: unknown;
  };
}

export const StudioDocumentSchema = z.object({
  schema: z.literal('vibress-studio'),
  version: z.number().int().positive(),
  editor: z
    .object({
      lexicalVersion: z.string().optional(),
    })
    .optional(),
  root: z.object({
    type: z.literal('root'),
    children: z.array(z.unknown()),
  }).passthrough(),
});

export function validateStudioDocument(doc: unknown): StudioDocument {
  if (!doc || typeof doc !== 'object') {
    throw new Error('INVALID_STUDIO_DOCUMENT: Document must be an object');
  }

  const result = StudioDocumentSchema.safeParse(doc);
  if (!result.success) {
    throw new Error(`INVALID_STUDIO_DOCUMENT: ${result.error.message}`);
  }

  return result.data as StudioDocument;
}

export function isValidStudioDocument(doc: unknown): doc is StudioDocument {
  try {
    validateStudioDocument(doc);
    return true;
  } catch {
    return false;
  }
}

export function createEmptyStudioDocument(): StudioDocument {
  return {
    schema: STUDIO_SCHEMA_NAME,
    version: CURRENT_STUDIO_VERSION,
    editor: {
      lexicalVersion: '0.13.1',
    },
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    },
  };
}

/**
 * LEGACY_CARD_NODE_TYPE and CANONICAL_CARD_NODE_TYPE
 *
 * The React/Lexical editor historically serialized its interactive card node
 * as `react-studio-card`. The canonical persisted/public schema uses
 * `studio-card`. The single normalization layer below converts legacy nodes
 * to canonical nodes at every read boundary, so downstream systems only ever
 * need to understand `studio-card`.
 */
export const LEGACY_CARD_NODE_TYPE = 'react-studio-card';
export const CANONICAL_CARD_NODE_TYPE = 'studio-card';

/**
 * Recursively normalize a Studio document to the canonical representation:
 *   react-studio-card → studio-card
 * preserving cardType, cardData, version, children, and every other field.
 * Canonical documents pass through unchanged. Unknown nodes are preserved
 * untouched (the renderer decides how to handle unknown types).
 */
export function normalizeStudioDocument<T>(rawDoc: T): T {
  if (Array.isArray(rawDoc)) {
    return rawDoc.map((item) => normalizeStudioDocument(item)) as unknown as T;
  }
  if (rawDoc && typeof rawDoc === 'object') {
    const obj = rawDoc as Record<string, unknown>;
    if (obj.type === LEGACY_CARD_NODE_TYPE) {
      return {
        ...obj,
        type: CANONICAL_CARD_NODE_TYPE,
        children: obj.children ? normalizeStudioDocument(obj.children) : obj.children,
      } as unknown as T;
    }
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      out[key] = normalizeStudioDocument(value);
    }
    return out as unknown as T;
  }
  return rawDoc;
}

export function createDefaultStudioDocument(text = ''): StudioDocument {
  if (!text) return createEmptyStudioDocument();

  return {
    schema: STUDIO_SCHEMA_NAME,
    version: CURRENT_STUDIO_VERSION,
    editor: {
      lexicalVersion: '0.13.1',
    },
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text: text,
              format: 0,
              detail: 0,
              mode: 'normal',
              style: '',
              version: 1,
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    },
  };
}

export class StudioMigrationError extends Error {
  readonly rawDocument: unknown;
  readonly code: 'UNSUPPORTED_DOCUMENT' | 'INVALID_DOCUMENT' | 'CORRUPTED_DOCUMENT';

  constructor(
    message: string,
    rawDocument: unknown,
    code: 'UNSUPPORTED_DOCUMENT' | 'INVALID_DOCUMENT' | 'CORRUPTED_DOCUMENT' = 'UNSUPPORTED_DOCUMENT'
  ) {
    super(message);
    this.name = 'StudioMigrationError';
    this.rawDocument = rawDocument;
    this.code = code;
  }
}

export function isStudioMigrationError(error: unknown): error is StudioMigrationError {
  return error instanceof Error && error.name === 'StudioMigrationError';
}

export function migrateDocument(rawDoc: unknown): StudioDocument {
  if (rawDoc === undefined || rawDoc === null) {
    return createEmptyStudioDocument();
  }

  // Handle legacy string content from Batch 2
  if (typeof rawDoc === 'string') {
    if (rawDoc.trim() === '') {
      return createEmptyStudioDocument();
    }
    // Parsing and migration have different failure semantics. A legacy plain
    // text string may not be JSON, but a valid JSON document with an invalid
    // envelope MUST NOT be converted to an editable paragraph of JSON text.
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawDoc);
    } catch {
      return createDefaultStudioDocument(rawDoc);
    }

    if (parsed !== null && typeof parsed === 'object') {
      try {
        return migrateDocument(parsed);
      } catch (error) {
        // Keep the actual persisted bytes available for recovery/export.
        // A nested StudioMigrationError must not be swallowed as parse failure.
        if (isStudioMigrationError(error)) {
          throw new StudioMigrationError(error.message, rawDoc, error.code);
        }
        throw error;
      }
    }

    // Preserve historical support for JSON-encoded strings and text that
    // happens to be a JSON primitive (for example a legacy article "123").
    return createDefaultStudioDocument(typeof parsed === 'string' ? parsed : rawDoc);
  }

  // Handle object inputs
  if (typeof rawDoc === 'object' && rawDoc !== null && !Array.isArray(rawDoc)) {
    const obj = rawDoc as Record<string, unknown>;

    // Canonical Studio document envelope
    if (obj.schema === 'vibress-studio') {
      if (obj.root && typeof obj.root === 'object') {
        try {
          return validateStudioDocument(normalizeStudioDocument(rawDoc));
        } catch (validationErr) {
          throw new StudioMigrationError(
            `Invalid persisted Studio document: ${validationErr instanceof Error ? validationErr.message : String(validationErr)}`,
            rawDoc,
            'INVALID_DOCUMENT'
          );
        }
      }
      throw new StudioMigrationError(
        'Invalid persisted Studio document: root must be an object',
        rawDoc,
        'INVALID_DOCUMENT'
      );
    }

    // Legacy Batch 2 format: { text: "..." }
    if (typeof obj.text === 'string') {
      return createDefaultStudioDocument(obj.text);
    }

    // Legacy Batch 2 format: { root: ... } without schema envelope
    if (obj.root && typeof obj.root === 'object') {
      const docCandidate: StudioDocument = {
        schema: STUDIO_SCHEMA_NAME,
        version: CURRENT_STUDIO_VERSION,
        editor: { lexicalVersion: '0.13.1' },
        root: normalizeStudioDocument(obj.root as StudioDocument['root']),
      };
      try {
        return validateStudioDocument(docCandidate);
      } catch (validationErr) {
        throw new StudioMigrationError(
          `Invalid legacy Studio document root: ${validationErr instanceof Error ? validationErr.message : String(validationErr)}`,
          rawDoc,
          'INVALID_DOCUMENT'
        );
      }
    }

    // Object is neither a Studio document nor a recognized legacy format
    throw new StudioMigrationError(
      'Unsupported persisted document format: unrecognized structure',
      rawDoc,
      'UNSUPPORTED_DOCUMENT'
    );
  }

  // Arrays, primitives (numbers, booleans, etc.)
  throw new StudioMigrationError(
    `Unsupported persisted document input type: ${Array.isArray(rawDoc) ? 'array' : typeof rawDoc}`,
    rawDoc,
    'UNSUPPORTED_DOCUMENT'
  );
}
