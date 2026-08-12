import { parseFragment } from 'parse5';
import {
  StudioDocument,
  createEmptyStudioDocument,
} from '@vibress/studio-core';
import { sanitizeHtmlFragment, isSafeUrl } from '@vibress/studio-utils';

/**
 * Parser-based HTML import (parse5). The regex-based importer was removed in
 * the P6 hardening phase: a WHATWG-spec parser cannot be confused by
 * malformed/entity-obfuscated markup the way regex can.
 *
 * Security: input is allowlist-sanitized BEFORE parsing, so scripts,
 * iframes, event handlers, and unsafe protocols never reach the document
 * model.
 */

interface ImportedNode {
  type: string;
  text?: string;
  format?: number;
  url?: string;
  tag?: string;
  listType?: string;
  cardType?: string;
  cardData?: Record<string, unknown>;
  children?: ImportedNode[];
  [key: string]: unknown;
}

// Lexical text format bitmask
const FMT_BOLD = 1;
const FMT_ITALIC = 2;
const FMT_STRIKE = 4;
const FMT_UNDERLINE = 8;
const FMT_CODE = 16;

function isElement(node: unknown): node is {
  nodeName: string;
  tagName: string;
  attrs: Array<{ name: string; value: string }>;
  childNodes: unknown[];
} {
  return (
    !!node &&
    typeof node === 'object' &&
    'tagName' in (node as Record<string, unknown>) &&
    'attrs' in (node as Record<string, unknown>)
  );
}

function isTextNode(node: unknown): node is { nodeName: string; value: string } {
  return (
    !!node &&
    typeof node === 'object' &&
    (node as { nodeName: string }).nodeName === '#text' &&
    'value' in (node as Record<string, unknown>)
  );
}

function attr(node: { attrs: Array<{ name: string; value: string }> }, name: string): string | undefined {
  const found = node.attrs.find((a) => a.name.toLowerCase() === name.toLowerCase());
  return found?.value;
}

function getAttrMap(node: { attrs: Array<{ name: string; value: string }> }): Record<string, string> {
  const map: Record<string, string> = {};
  for (const a of node.attrs) {
    map[a.name.toLowerCase()] = a.value;
  }
  return map;
}

/** Convert inline children into formatted text nodes (merging adjacent). */
function convertInlineChildren(childNodes: unknown[], format: number, acc: ImportedNode[]): void {
  for (const child of childNodes) {
    if (isTextNode(child)) {
      const text = child.value;
      if (!text) continue;
      pushText(acc, text, format);
    } else if (isElement(child)) {
      const tag = child.tagName.toLowerCase();
      if (tag === 'br') {
        pushText(acc, ' ', format);
        continue;
      }
      let childFormat = format;
      if (tag === 'strong' || tag === 'b') childFormat |= FMT_BOLD;
      if (tag === 'em' || tag === 'i') childFormat |= FMT_ITALIC;
      if (tag === 's' || tag === 'strike' || tag === 'del') childFormat |= FMT_STRIKE;
      if (tag === 'u') childFormat |= FMT_UNDERLINE;
      if (tag === 'code') childFormat |= FMT_CODE;

      if (tag === 'a') {
        const href = attr(child, 'href');
        const safeHref = href && isSafeUrl(href) ? href : undefined;
        const linkChildren: ImportedNode[] = [];
        convertInlineChildren(child.childNodes, childFormat, linkChildren);
        if (safeHref && linkChildren.length > 0) {
          acc.push({ type: 'link', url: safeHref, children: linkChildren });
        } else {
          acc.push(...linkChildren);
        }
        continue;
      }

      convertInlineChildren(child.childNodes, childFormat, acc);
    }
  }
}

function pushText(acc: ImportedNode[], text: string, format: number): void {
  const last = acc[acc.length - 1];
  if (last && last.type === 'text' && last.format === format && typeof last.text === 'string') {
    last.text += text;
    return;
  }
  acc.push({ type: 'text', text, format, mode: 'normal', version: 1 });
}

function createTextNode(text: string, format = 0): ImportedNode {
  return { type: 'text', text, format, mode: 'normal', version: 1 };
}

function convertBlock(childNodes: unknown[], out: ImportedNode[]): void {
  for (const child of childNodes) {
    if (!isElement(child)) {
      if (isTextNode(child) && child.value.trim()) {
        out.push({ type: 'paragraph', children: [createTextNode(child.value.trim())] });
      }
      continue;
    }

    const tag = child.tagName.toLowerCase();
    const attrs = getAttrMap(child);

    switch (tag) {
      case 'p':
      case 'div': {
        const children: ImportedNode[] = [];
        convertInlineChildren(child.childNodes, 0, children);
        out.push({ type: 'paragraph', children });
        break;
      }
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        const children: ImportedNode[] = [];
        convertInlineChildren(child.childNodes, 0, children);
        out.push({ type: 'heading', tag, children });
        break;
      }
      case 'blockquote': {
        const children: ImportedNode[] = [];
        convertBlock(child.childNodes, children);
        out.push({ type: 'quote', children });
        break;
      }
      case 'ul':
      case 'ol': {
        const children: ImportedNode[] = [];
        convertBlock(child.childNodes, children);
        out.push({ type: 'list', listType: tag === 'ol' ? 'number' : 'bullet', children });
        break;
      }
      case 'li': {
        const children: ImportedNode[] = [];
        convertInlineChildren(child.childNodes, 0, children);
        out.push({ type: 'listitem', children });
        break;
      }
      case 'pre': {
        const codeText = collectText(child.childNodes).trim();
        if (codeText) {
          out.push({
            type: 'code',
            children: [createTextNode(codeText, 0)],
            language: attrs['data-language'] || '',
          });
        }
        break;
      }
      case 'figure': {
        convertFigure(child, out);
        break;
      }
      case 'img': {
        const src = attrs.src;
        if (src && isSafeUrl(src)) {
          out.push({
            type: 'studio-card',
            cardType: 'image',
            cardData: { src, alt: attrs.alt || '', width: 'regular' },
            version: 1,
          });
        }
        break;
      }
      case 'hr':
        out.push({ type: 'studio-card', cardType: 'divider', cardData: { style: 'solid' }, version: 1 });
        break;
      case 'a': {
        // Standalone link block (e.g. embed fallback) → bookmark/embed-safe link.
        const href = attrs.href;
        const children: ImportedNode[] = [];
        convertInlineChildren(child.childNodes, 0, children);
        if (href && isSafeUrl(href)) {
          out.push({ type: 'link', url: href, children });
        } else if (children.length > 0) {
          out.push({ type: 'paragraph', children });
        }
        break;
      }
      default: {
        // Unknown block-level tag: render children inline inside a paragraph.
        const children: ImportedNode[] = [];
        convertInlineChildren(child.childNodes, 0, children);
        if (children.length > 0) {
          out.push({ type: 'paragraph', children });
        }
      }
    }
  }
}

function collectText(childNodes: unknown[]): string {
  let text = '';
  for (const node of childNodes) {
    if (isTextNode(node)) text += node.value;
    else if (isElement(node)) text += collectText(node.childNodes);
  }
  return text;
}

/** figure → image card with caption (only when a single safe img is present). */
function convertFigure(node: { attrs: Array<{ name: string; value: string }>; childNodes: unknown[] }, out: ImportedNode[]): void {
  const captionText: string[] = [];
  let imgNode: (typeof node) | null = null;
  const walk = (childNodes: unknown[]): void => {
    for (const child of childNodes) {
      if (isElement(child)) {
        const tag = child.tagName.toLowerCase();
        if (tag === 'img' && !imgNode) {
          imgNode = child;
        } else if (tag === 'figcaption') {
          captionText.push(collectText(child.childNodes).trim());
        } else {
          walk(child.childNodes);
        }
      }
    }
  };
  walk(node.childNodes);

  if (imgNode) {
    const attrs = getAttrMap(imgNode);
    const src = attrs.src;
    if (src && isSafeUrl(src)) {
      const caption = captionText.filter(Boolean).join(' ');
      out.push({
        type: 'studio-card',
        cardType: 'image',
        cardData: {
          src,
          alt: attrs.alt || '',
          width: 'regular',
          ...(caption ? { caption, captionHtml: caption } : {}),
        },
        version: 1,
      });
      return;
    }
  }
  // Unsupported figure: fall back to its text content.
  const text = collectText(node.childNodes).trim();
  if (text) out.push({ type: 'paragraph', children: [createTextNode(text)] });
}

function toSerializable(node: ImportedNode): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'children') {
      out.children = (value as ImportedNode[]).map(toSerializable);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Import an HTML fragment/string into a Studio document.
 */
export function htmlToStudioDocument(htmlInput: string): StudioDocument {
  if (!htmlInput || typeof htmlInput !== 'string') {
    return createEmptyStudioDocument();
  }

  // 1) Sanitize with the allowlist policy (never parse raw input).
  const cleanHtml = sanitizeHtmlFragment(htmlInput.trim());
  if (!cleanHtml) {
    return createEmptyStudioDocument();
  }

  // 2) Parse with the WHATWG parser.
  const fragment = parseFragment(cleanHtml, {
    sourceCodeLocationInfo: false,
    scriptingEnabled: false,
  });

  const children: ImportedNode[] = [];
  convertBlock(fragment.childNodes as unknown[], children);

  // 3) Normalize: merge consecutive same-format text nodes is already done
  //    inline; top-level blocks are left as-is.
  if (children.length === 0) {
    return createEmptyStudioDocument();
  }

  return {
    schema: 'vibress-studio',
    version: 1,
    editor: { lexicalVersion: '0.13.1' },
    root: {
      type: 'root',
      children: children.map(toSerializable),
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    },
  };
}
