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

// ============================================================================
// STU-201: Typed Node Schemas & Type Guards
// ============================================================================

export const StudioTextNodeSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  format: z.number().int().optional(),
  detail: z.number().int().optional(),
  mode: z.string().optional(),
  style: z.string().optional(),
  version: z.number().optional(),
}).passthrough();
export type StudioTextNode = z.infer<typeof StudioTextNodeSchema>;

export const StudioParagraphNodeSchema = z.object({
  type: z.literal('paragraph'),
  children: z.array(z.unknown()),
  direction: z.enum(['ltr', 'rtl']).nullable().optional(),
  format: z.union([z.string(), z.number()]).optional(),
  indent: z.number().optional(),
  version: z.number().optional(),
}).passthrough();
export type StudioParagraphNode = z.infer<typeof StudioParagraphNodeSchema>;

export const StudioHeadingTagSchema = z.enum(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
export type StudioHeadingTag = z.infer<typeof StudioHeadingTagSchema>;

export const StudioHeadingNodeSchema = z.object({
  type: z.literal('heading'),
  tag: StudioHeadingTagSchema,
  children: z.array(z.unknown()),
  direction: z.enum(['ltr', 'rtl']).nullable().optional(),
  format: z.union([z.string(), z.number()]).optional(),
  indent: z.number().optional(),
  version: z.number().optional(),
}).passthrough();
export type StudioHeadingNode = z.infer<typeof StudioHeadingNodeSchema>;

export const StudioLinkNodeSchema = z.object({
  type: z.literal('link'),
  url: z.string(),
  children: z.array(z.unknown()),
  target: z.string().optional(),
  rel: z.string().optional(),
  version: z.number().optional(),
}).passthrough();
export type StudioLinkNode = z.infer<typeof StudioLinkNodeSchema>;

export const StudioListNodeSchema = z.object({
  type: z.literal('list'),
  listType: z.enum(['bullet', 'number', 'check']),
  children: z.array(z.unknown()),
  start: z.number().optional(),
  tag: z.string().optional(),
  version: z.number().optional(),
}).passthrough();
export type StudioListNode = z.infer<typeof StudioListNodeSchema>;

export const StudioListItemNodeSchema = z.object({
  type: z.literal('listitem'),
  children: z.array(z.unknown()),
  checked: z.boolean().optional(),
  value: z.number().optional(),
  version: z.number().optional(),
}).passthrough();
export type StudioListItemNode = z.infer<typeof StudioListItemNodeSchema>;

export const StudioCodeNodeSchema = z.object({
  type: z.literal('code'),
  children: z.array(z.unknown()),
  language: z.string().optional(),
  version: z.number().optional(),
}).passthrough();
export type StudioCodeNode = z.infer<typeof StudioCodeNodeSchema>;

export const StudioTableCellNodeSchema = z.object({
  type: z.literal('tablecell'),
  children: z.array(z.unknown()),
  colSpan: z.number().int().positive().optional(),
  rowSpan: z.number().int().positive().optional(),
  headerState: z.number().optional(),
  backgroundColor: z.string().optional(),
  version: z.number().optional(),
}).passthrough();
export type StudioTableCellNode = z.infer<typeof StudioTableCellNodeSchema>;

export const StudioTableRowNodeSchema = z.object({
  type: z.literal('tablerow'),
  children: z.array(z.unknown()),
  version: z.number().optional(),
}).passthrough();
export type StudioTableRowNode = z.infer<typeof StudioTableRowNodeSchema>;

export const StudioTableNodeSchema = z.object({
  type: z.literal('table'),
  children: z.array(z.unknown()),
  version: z.number().optional(),
}).passthrough();
export type StudioTableNode = z.infer<typeof StudioTableNodeSchema>;

export const StudioCardNodeDataSchema = z.object({
  type: z.literal('studio-card'),
  cardType: z.string(),
  cardData: z.record(z.string(), z.unknown()).default({}),
  version: z.number().optional(),
}).passthrough();
export type StudioCardNode = z.infer<typeof StudioCardNodeDataSchema>;

const VALID_HEADING_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
const VALID_LIST_TYPES = new Set(['bullet', 'number', 'check']);

export function isStudioTextNode(node: unknown): node is StudioTextNode {
  if (typeof node !== 'object' || node === null) return false;
  const n = node as Record<string, unknown>;
  return n.type === 'text' && typeof n.text === 'string';
}

export function isStudioHeadingNode(node: unknown): node is StudioHeadingNode {
  if (typeof node !== 'object' || node === null) return false;
  const n = node as Record<string, unknown>;
  return (
    n.type === 'heading' &&
    typeof n.tag === 'string' &&
    VALID_HEADING_TAGS.has(n.tag.toLowerCase()) &&
    Array.isArray(n.children)
  );
}

export function isStudioParagraphNode(node: unknown): node is StudioParagraphNode {
  if (typeof node !== 'object' || node === null) return false;
  const n = node as Record<string, unknown>;
  return n.type === 'paragraph' && Array.isArray(n.children);
}

export function isStudioLinkNode(node: unknown): node is StudioLinkNode {
  if (typeof node !== 'object' || node === null) return false;
  const n = node as Record<string, unknown>;
  return n.type === 'link' && typeof n.url === 'string' && Array.isArray(n.children);
}

export function isStudioListNode(node: unknown): node is StudioListNode {
  if (typeof node !== 'object' || node === null) return false;
  const n = node as Record<string, unknown>;
  return (
    n.type === 'list' &&
    typeof n.listType === 'string' &&
    VALID_LIST_TYPES.has(n.listType) &&
    Array.isArray(n.children)
  );
}

export function isStudioListItemNode(node: unknown): node is StudioListItemNode {
  if (typeof node !== 'object' || node === null) return false;
  const n = node as Record<string, unknown>;
  return n.type === 'listitem' && Array.isArray(n.children);
}

export function isStudioCodeNode(node: unknown): node is StudioCodeNode {
  if (typeof node !== 'object' || node === null) return false;
  const n = node as Record<string, unknown>;
  return n.type === 'code' && Array.isArray(n.children);
}

export function isStudioTableNode(node: unknown): node is StudioTableNode {
  if (typeof node !== 'object' || node === null) return false;
  const n = node as Record<string, unknown>;
  return n.type === 'table' && Array.isArray(n.children);
}

export function isStudioTableRowNode(node: unknown): node is StudioTableRowNode {
  if (typeof node !== 'object' || node === null) return false;
  const n = node as Record<string, unknown>;
  return n.type === 'tablerow' && Array.isArray(n.children);
}

export function isStudioTableCellNode(node: unknown): node is StudioTableCellNode {
  if (typeof node !== 'object' || node === null) return false;
  const n = node as Record<string, unknown>;
  return n.type === 'tablecell' && Array.isArray(n.children);
}

export function isStudioCardNode(node: unknown): node is StudioCardNode {
  if (typeof node !== 'object' || node === null) return false;
  const n = node as Record<string, unknown>;
  return (
    n.type === 'studio-card' &&
    typeof n.cardType === 'string' &&
    n.cardType.trim().length > 0 &&
    typeof n.cardData === 'object' &&
    n.cardData !== null &&
    !Array.isArray(n.cardData)
  );
}

// ============================================================================
// STU-203: Document Resource Limits
// ============================================================================

export interface DocumentResourceLimits {
  /** Maximum serialized JSON size in bytes (default 5MB). */
  maxSizeBytes?: number;
  /** Maximum total node count in the document tree (default 50,000). */
  maxNodeCount?: number;
  /** Maximum tree nesting depth (default 64). */
  maxDepth?: number;
}

export const DEFAULT_DOCUMENT_RESOURCE_LIMITS: Required<DocumentResourceLimits> = {
  maxSizeBytes: 5 * 1024 * 1024, // 5 MB
  maxNodeCount: 50_000,
  maxDepth: 64,
};

export function resolveResourceLimits(limits?: DocumentResourceLimits): Required<DocumentResourceLimits> {
  const maxSizeBytes =
    typeof limits?.maxSizeBytes === 'number' && Number.isFinite(limits.maxSizeBytes) && limits.maxSizeBytes > 0
      ? limits.maxSizeBytes
      : DEFAULT_DOCUMENT_RESOURCE_LIMITS.maxSizeBytes;

  const maxNodeCount =
    typeof limits?.maxNodeCount === 'number' && Number.isFinite(limits.maxNodeCount) && limits.maxNodeCount > 0
      ? Math.floor(limits.maxNodeCount)
      : DEFAULT_DOCUMENT_RESOURCE_LIMITS.maxNodeCount;

  const maxDepth =
    typeof limits?.maxDepth === 'number' && Number.isFinite(limits.maxDepth) && limits.maxDepth > 0
      ? Math.floor(limits.maxDepth)
      : DEFAULT_DOCUMENT_RESOURCE_LIMITS.maxDepth;

  return { maxSizeBytes, maxNodeCount, maxDepth };
}

export function getUtf8ByteLength(str: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  let bytes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

function getJsonStringByteLength(str: string): number {
  let extraEscapes = 0;
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code === 34 || code === 92) {
      extraEscapes += 1;
    } else if (code < 32) {
      if (code === 8 || code === 9 || code === 10 || code === 12 || code === 13) {
        extraEscapes += 1;
      } else {
        extraEscapes += 5;
      }
    }
  }
  return 2 + getUtf8ByteLength(str) + extraEscapes;
}

function checkObjectResourceLimits(
  rootObj: object,
  rawDoc: unknown,
  limits: Required<DocumentResourceLimits>
): void {
  let accumulatedBytes = 0;
  let nodeCount = 0;
  let totalSteps = 0;
  const visited = new Set<unknown>();

  function traverse(item: unknown, depth: number, isAstNode: boolean): void {
    if (depth > limits.maxDepth) {
      throw new StudioMigrationError(
        `Document nesting depth (${depth}) exceeds maximum allowed limit (${limits.maxDepth}).`,
        rawDoc,
        'RESOURCE_LIMIT_EXCEEDED'
      );
    }

    totalSteps++;
    if (totalSteps > limits.maxNodeCount * 10) {
      throw new StudioMigrationError(
        `Document complexity exceeds maximum processing limits.`,
        rawDoc,
        'RESOURCE_LIMIT_EXCEEDED'
      );
    }

    if (item === null || item === undefined) {
      accumulatedBytes += 4; // 'null'
      if (accumulatedBytes > limits.maxSizeBytes) {
        throw new StudioMigrationError(
          `Document size (${(accumulatedBytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit (${(limits.maxSizeBytes / (1024 * 1024)).toFixed(2)} MB).`,
          rawDoc,
          'RESOURCE_LIMIT_EXCEEDED'
        );
      }
      return;
    }

    const itemType = typeof item;
    if (itemType === 'string') {
      accumulatedBytes += getJsonStringByteLength(item as string);
      if (accumulatedBytes > limits.maxSizeBytes) {
        throw new StudioMigrationError(
          `Document size (${(accumulatedBytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit (${(limits.maxSizeBytes / (1024 * 1024)).toFixed(2)} MB).`,
          rawDoc,
          'RESOURCE_LIMIT_EXCEEDED'
        );
      }
      return;
    }

    if (itemType === 'number') {
      accumulatedBytes += Number.isFinite(item as number) ? String(item).length : 4;
      if (accumulatedBytes > limits.maxSizeBytes) {
        throw new StudioMigrationError(
          `Document size (${(accumulatedBytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit (${(limits.maxSizeBytes / (1024 * 1024)).toFixed(2)} MB).`,
          rawDoc,
          'RESOURCE_LIMIT_EXCEEDED'
        );
      }
      return;
    }

    if (itemType === 'boolean') {
      accumulatedBytes += item ? 4 : 5;
      if (accumulatedBytes > limits.maxSizeBytes) {
        throw new StudioMigrationError(
          `Document size (${(accumulatedBytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit (${(limits.maxSizeBytes / (1024 * 1024)).toFixed(2)} MB).`,
          rawDoc,
          'RESOURCE_LIMIT_EXCEEDED'
        );
      }
      return;
    }

    if (itemType !== 'object') {
      return;
    }

    if (visited.has(item)) {
      throw new StudioMigrationError(
        'Cyclic reference detected in document tree.',
        rawDoc,
        'CORRUPTED_DOCUMENT'
      );
    }
    visited.add(item);

    if (Array.isArray(item)) {
      accumulatedBytes += 2; // '[]'
      for (let i = 0; i < item.length; i++) {
        if (i > 0) accumulatedBytes += 1; // ','
        traverse(item[i], depth + 1, isAstNode);
      }
    } else {
      accumulatedBytes += 2; // '{}'
      const obj = item as Record<string, unknown>;

      if (isAstNode) {
        nodeCount++;
        if (nodeCount > limits.maxNodeCount) {
          throw new StudioMigrationError(
            `Document node count (${nodeCount}) exceeds maximum allowed limit (${limits.maxNodeCount}).`,
            rawDoc,
            'RESOURCE_LIMIT_EXCEEDED'
          );
        }
      }

      let writtenFields = 0;
      for (const [k, v] of Object.entries(obj)) {
        if (v === undefined || typeof v === 'function') continue;
        if (writtenFields > 0) accumulatedBytes += 1; // ','
        accumulatedBytes += getJsonStringByteLength(k) + 1; // "key":

        const childIsAstNode = (k === 'root' || k === 'children') && typeof v === 'object' && v !== null;
        traverse(v, depth + 1, childIsAstNode);
        writtenFields++;
      }
    }

    visited.delete(item);

    if (accumulatedBytes > limits.maxSizeBytes) {
      throw new StudioMigrationError(
        `Document size (${(accumulatedBytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit (${(limits.maxSizeBytes / (1024 * 1024)).toFixed(2)} MB).`,
        rawDoc,
        'RESOURCE_LIMIT_EXCEEDED'
      );
    }
  }

  traverse(rootObj, 1, true);
}

export function checkDocumentResourceLimits(
  rawDoc: unknown,
  limits: DocumentResourceLimits = {}
): void {
  const merged = resolveResourceLimits(limits);

  if (typeof rawDoc === 'string') {
    const bytes = getUtf8ByteLength(rawDoc);
    if (bytes > merged.maxSizeBytes) {
      throw new StudioMigrationError(
        `Document size (${(bytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit (${(merged.maxSizeBytes / (1024 * 1024)).toFixed(2)} MB).`,
        rawDoc,
        'RESOURCE_LIMIT_EXCEEDED'
      );
    }

    try {
      const parsed = JSON.parse(rawDoc);
      if (parsed && typeof parsed === 'object') {
        checkObjectResourceLimits(parsed as object, rawDoc, merged);
      }
    } catch (err) {
      if (isStudioMigrationError(err)) {
        throw err;
      }
      // Non-JSON plain strings are governed by maxSizeBytes alone
    }
    return;
  }

  if (rawDoc && typeof rawDoc === 'object') {
    checkObjectResourceLimits(rawDoc as object, rawDoc, merged);
  }
}

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
  readonly code: 'UNSUPPORTED_DOCUMENT' | 'INVALID_DOCUMENT' | 'CORRUPTED_DOCUMENT' | 'RESOURCE_LIMIT_EXCEEDED';

  constructor(
    message: string,
    rawDocument: unknown,
    code: 'UNSUPPORTED_DOCUMENT' | 'INVALID_DOCUMENT' | 'CORRUPTED_DOCUMENT' | 'RESOURCE_LIMIT_EXCEEDED' = 'UNSUPPORTED_DOCUMENT'
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

export function migrateDocument(rawDoc: unknown, limits?: DocumentResourceLimits): StudioDocument {
  if (rawDoc === undefined || rawDoc === null) {
    return createEmptyStudioDocument();
  }

  // STU-203: Validate document resource limits before processing
  checkDocumentResourceLimits(rawDoc, limits);

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
