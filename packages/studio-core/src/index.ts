import { z } from 'zod';
import { inspectEditableStudioNode } from './editable-node-schemas';
export * from './editable-node-schemas';

export const STUDIO_SCHEMA_NAME = 'vibress-studio';
export const CURRENT_STUDIO_VERSION = 1;

export interface StudioDocument {
  schema: 'vibress-studio';
  version: number;
  editor?: {
    lexicalVersion?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
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
    }).passthrough()
    .optional(),
  root: z.object({
    type: z.literal('root'),
    children: z.array(z.unknown()),
  }).passthrough(),
}).passthrough();

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
  target: z.string().nullable().optional(),
  rel: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
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
  backgroundColor: z.string().nullable().optional(),
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
  cardType: z.string().min(1),
  cardData: z.record(z.string(), z.unknown()).default({}),
  version: z.number().optional(),
}).passthrough();
export type StudioCardNode = z.infer<typeof StudioCardNodeDataSchema>;

export function isStudioTextNode(node: unknown): node is StudioTextNode {
  return StudioTextNodeSchema.safeParse(node).success;
}

export function isStudioHeadingNode(node: unknown): node is StudioHeadingNode {
  return StudioHeadingNodeSchema.safeParse(node).success;
}

export function isStudioParagraphNode(node: unknown): node is StudioParagraphNode {
  return StudioParagraphNodeSchema.safeParse(node).success;
}

export function isStudioLinkNode(node: unknown): node is StudioLinkNode {
  return StudioLinkNodeSchema.safeParse(node).success;
}

export function isStudioListNode(node: unknown): node is StudioListNode {
  return StudioListNodeSchema.safeParse(node).success;
}

export function isStudioListItemNode(node: unknown): node is StudioListItemNode {
  return StudioListItemNodeSchema.safeParse(node).success;
}

export function isStudioCodeNode(node: unknown): node is StudioCodeNode {
  return StudioCodeNodeSchema.safeParse(node).success;
}

export function isStudioTableNode(node: unknown): node is StudioTableNode {
  return StudioTableNodeSchema.safeParse(node).success;
}

export function isStudioTableRowNode(node: unknown): node is StudioTableRowNode {
  return StudioTableRowNodeSchema.safeParse(node).success;
}

export function isStudioTableCellNode(node: unknown): node is StudioTableCellNode {
  return StudioTableCellNodeSchema.safeParse(node).success;
}

export function isStudioCardNode(node: unknown): node is StudioCardNode {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) {
    return false;
  }
  const candidate = node as Record<string, unknown>;
  if (
    typeof candidate.cardData !== 'object' ||
    candidate.cardData === null ||
    Array.isArray(candidate.cardData)
  ) {
    return false;
  }
  return StudioCardNodeDataSchema.safeParse(node).success;
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
  /** Optional per-string byte budget for text and attributes; defaults to the document size budget. */
  maxStringBytes?: number;
}

export const DEFAULT_DOCUMENT_RESOURCE_LIMITS: Required<DocumentResourceLimits> = {
  maxSizeBytes: 5 * 1024 * 1024, // 5 MB
  maxNodeCount: 50_000,
  maxDepth: 64,
  maxStringBytes: 5 * 1024 * 1024,
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

  const maxStringBytes = typeof limits?.maxStringBytes === 'number' && Number.isFinite(limits.maxStringBytes) && limits.maxStringBytes > 0
    ? limits.maxStringBytes : maxSizeBytes;
  return { maxSizeBytes, maxNodeCount, maxDepth, maxStringBytes };
}

export function getUtf8ByteLength(str: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  let bytes = 0;
  const len = str.length;
  for (let i = 0; i < len; i++) {
    const code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      if (i + 1 < len) {
        const next = str.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          bytes += 4;
          i++;
          continue;
        }
      }
      // Unpaired high surrogate -> WHATWG TextEncoder emits U+FFFD (3 bytes in UTF-8)
      bytes += 3;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      // Unpaired low surrogate -> WHATWG TextEncoder emits U+FFFD (3 bytes in UTF-8)
      bytes += 3;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

export function getJsonStringByteLength(str: string): number {
  let bytes = 2; // Opening and closing JSON quotes ""
  const len = str.length;

  for (let i = 0; i < len; i++) {
    const code = str.charCodeAt(i);

    if (code === 34 || code === 92) {
      // \" or \\
      bytes += 2;
    } else if (code < 32) {
      // Control characters
      if (code === 8 || code === 9 || code === 10 || code === 12 || code === 13) {
        // \b, \t, \n, \f, \r
        bytes += 2;
      } else {
        // \u00xx
        bytes += 6;
      }
    } else if (code < 0x80) {
      // ASCII 0x20 - 0x7E
      bytes += 1;
    } else if (code < 0x800) {
      // 2-byte UTF-8
      bytes += 2;
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // High surrogate
      if (i + 1 < len) {
        const next = str.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          // Valid surrogate pair -> 4-byte UTF-8 character in JSON output
          bytes += 4;
          i++;
          continue;
        }
      }
      // Unpaired high surrogate -> JSON.stringify escapes as \udxxx (6 ASCII bytes)
      bytes += 6;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      // Unpaired low surrogate -> JSON.stringify escapes as \udxxx (6 ASCII bytes)
      bytes += 6;
    } else {
      // 3-byte UTF-8 (0x800 - 0xFFFF except surrogates)
      bytes += 3;
    }
  }

  return bytes;
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
      if (limits.maxStringBytes < limits.maxSizeBytes && getUtf8ByteLength(item as string) > limits.maxStringBytes) {
        throw new StudioMigrationError('Document text or attribute exceeds the configured string byte limit.', rawDoc, 'RESOURCE_LIMIT_EXCEEDED');
      }
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
      if (!Number.isFinite(item as number)) {
        throw new StudioMigrationError('Non-finite numbers cannot be preserved as JSON.', rawDoc, 'INVALID_DOCUMENT');
      }
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
      throw new StudioMigrationError('Document contains a value that cannot be preserved as JSON.', rawDoc, 'INVALID_DOCUMENT');
    }

    // The size estimator models JSON data, not JavaScript object serialization
    // hooks. Reject custom objects and callable/accessor toJSON without invoking
    // user code; otherwise a tiny object can serialize into an oversized value.
    const prototype = Object.getPrototypeOf(item);
    if (Object.getOwnPropertySymbols(item).length) {
      throw new StudioMigrationError('Symbol properties cannot be preserved as JSON.', rawDoc, 'INVALID_DOCUMENT');
    }
    const isArray = Array.isArray(item);
    const isPlainObject = prototype === Object.prototype || prototype === null;
    if (isArray ? prototype !== Array.prototype : !isPlainObject) {
      throw new StudioMigrationError(
        'Document must contain plain JSON objects and arrays.',
        rawDoc,
        'INVALID_DOCUMENT'
      );
    }
    const ownToJson = Object.getOwnPropertyDescriptor(item, 'toJSON');
    const inheritedToJson = prototype === null ? undefined : Object.getOwnPropertyDescriptor(prototype, 'toJSON');
    const isUnsafeSerializer = (descriptor: PropertyDescriptor | undefined): boolean =>
      Boolean(descriptor && (!('value' in descriptor) || typeof descriptor.value === 'function'));
    if (isUnsafeSerializer(ownToJson) || isUnsafeSerializer(inheritedToJson)) {
      throw new StudioMigrationError(
        'Custom toJSON serialization is not supported in Studio documents.',
        rawDoc,
        'INVALID_DOCUMENT'
      );
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
        const descriptor = Object.getOwnPropertyDescriptor(item, String(i));
        if (descriptor && !('value' in descriptor)) {
          throw new StudioMigrationError('Accessor properties are not supported in Studio documents.', rawDoc, 'INVALID_DOCUMENT');
        }
        // JSON.stringify represents holes and undefined array elements as null.
        traverse(descriptor?.value, depth + 1, isAstNode);
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
      for (const k of Object.keys(obj)) {
        const descriptor = Object.getOwnPropertyDescriptor(obj, k);
        if (!descriptor || !('value' in descriptor)) {
          throw new StudioMigrationError('Accessor properties are not supported in Studio documents.', rawDoc, 'INVALID_DOCUMENT');
        }
        const v: unknown = descriptor.value;
        if (v === undefined) continue;
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
    throw new StudioMigrationError('INVALID_STUDIO_DOCUMENT: Document must be an object', doc, 'INVALID_DOCUMENT');
  }

  const result = StudioDocumentSchema.safeParse(doc);
  if (!result.success) {
    throw new StudioMigrationError(`INVALID_STUDIO_DOCUMENT: ${result.error.message}`, doc, 'INVALID_DOCUMENT');
  }

  // There are no coercions/defaults in the envelope. Preserve the validated
  // original rather than Zod's copy (which intentionally omits __proto__).
  return doc as StudioDocument;
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
      Object.defineProperty(out, key, { value: normalizeStudioDocument(value), enumerable: true, writable: true, configurable: true });
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

/** Additional admission boundary for the pinned editor. Persistence and
 * rendering can retain future data that this editor cannot safely rewrite. */
export function assertStudioDocumentEditable(document: StudioDocument, rawDocument: unknown = document): void {
  if (document.version !== CURRENT_STUDIO_VERSION) {
    throw new StudioMigrationError(
      `Cannot edit Studio document version ${document.version} with a version ${CURRENT_STUDIO_VERSION} editor.`,
      rawDocument, 'UNSUPPORTED_DOCUMENT'
    );
  }
  const pending: Array<{ node: unknown; path: string; parent?: string }> = [{ node: document.root, path: 'root' }];
  while (pending.length) {
    const current = pending.pop();
    if (!current) break;
    const issue = inspectEditableStudioNode(current.node);
    if (issue) throw new StudioMigrationError(`${issue.message} at ${current.path}.`, rawDocument, issue.code);
    const entry = z.object({ type: z.string(), children: z.array(z.unknown()).optional() }).safeParse(current.node);
    if (!entry.success) throw new StudioMigrationError('Invalid node structure.', rawDocument, 'INVALID_DOCUMENT');
    const type = entry.data.type;
    const invalidParent = (type === 'root' && current.parent !== undefined) ||
      (current.parent === 'root' && ['root', 'text', 'code-highlight', 'tab', 'linebreak', 'link', 'autolink', 'listitem', 'tablerow', 'tablecell'].includes(type)) ||
      (current.parent === 'table' && type !== 'tablerow') ||
      (current.parent === 'tablerow' && type !== 'tablecell') ||
      (current.parent === 'list' && type !== 'listitem');
    if (invalidParent) throw new StudioMigrationError(`Invalid ${type} placement at ${current.path}.`, rawDocument, 'INVALID_DOCUMENT');
    entry.data.children?.forEach((node, index) => {
      pending.push({ node, path: `${current.path}.children[${index}]`, parent: type });
    });
  }
}

/** Restore only the unambiguous structural fields omitted by historical roots.
 * Explicit types and incomplete roots containing other data require recovery. */
function migrateLegacyRoot(root: unknown): unknown {
  if (!root || typeof root !== 'object' || Array.isArray(root) || 'type' in root) return root;
  if ('children' in root && Array.isArray(root.children)) return { ...root, type: 'root' };
  if (Object.keys(root).length === 0) return { type: 'root', children: [] };
  return root;
}

function validateMigratedDocument(candidate: unknown, original: unknown, limits?: DocumentResourceLimits): StudioDocument {
  try {
    checkDocumentResourceLimits(candidate, limits);
    return validateStudioDocument(candidate);
  } catch (error) {
    if (isStudioMigrationError(error)) {
      throw new StudioMigrationError(error.message, original, error.code);
    }
    throw error;
  }
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
        return migrateDocument(parsed, limits);
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
        const root = obj.version === CURRENT_STUDIO_VERSION ? migrateLegacyRoot(obj.root) : obj.root;
        return validateMigratedDocument(normalizeStudioDocument({ ...obj, root }), rawDoc, limits);
      }
      throw new StudioMigrationError(
        'Invalid persisted Studio document: root must be an object',
        rawDoc,
        'INVALID_DOCUMENT'
      );
    }

    if (obj.schema !== undefined) {
      throw new StudioMigrationError('Unsupported persisted document schema.', rawDoc, 'UNSUPPORTED_DOCUMENT');
    }

    // Legacy Batch 2 format: { text: "..." }
    if (typeof obj.text === 'string') {
      return createDefaultStudioDocument(obj.text);
    }

    // Legacy Batch 2 format: { root: ... } without schema envelope
    if (obj.root && typeof obj.root === 'object') {
      const docCandidate = {
        schema: STUDIO_SCHEMA_NAME,
        version: CURRENT_STUDIO_VERSION,
        editor: { lexicalVersion: '0.13.1' },
        root: normalizeStudioDocument(obj.version === undefined || obj.version === CURRENT_STUDIO_VERSION
          ? migrateLegacyRoot(obj.root) : obj.root),
      };
      return validateMigratedDocument(docCandidate, rawDoc, limits);
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
