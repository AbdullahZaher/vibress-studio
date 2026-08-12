import MarkdownIt from 'markdown-it';
import {
  StudioDocument,
  createEmptyStudioDocument,
  migrateDocument,
} from '@vibress/studio-core';
import { isSafeUrl } from '@vibress/studio-utils';

const mdParser = new MarkdownIt({ html: false, linkify: true });

export function parseMarkdownToHtml(markdown: string): string {
  if (!markdown) return '';
  return mdParser.render(markdown);
}

/**
 * Deterministic structured fallback for cards that have no native markdown
 * representation:
 *
 *   ::vibress-card{type="gallery"}
 *   {"images":[...]}
 *   ::
 */
const CARD_FENCE = '::vibress-card';

// Lexical text format bitmask
const FMT_BOLD = 1;
const FMT_ITALIC = 2;
const FMT_STRIKE = 4;
const FMT_UNDERLINE = 8;
const FMT_CODE = 16;

interface MdNode {
  type: string;
  text?: string;
  format?: number;
  url?: string;
  tag?: string;
  listType?: string;
  cardType?: string;
  cardData?: Record<string, unknown>;
  children?: MdNode[];
  [key: string]: unknown;
}

function pushText(acc: MdNode[], text: string, format: number): void {
  const last = acc[acc.length - 1];
  if (last && last.type === 'text' && last.format === format) {
    last.text = (last.text || '') + text;
    return;
  }
  acc.push({ type: 'text', text, format, mode: 'normal', version: 1 });
}

/**
 * Convert markdown-it inline tokens to formatted text/link nodes.
 */
/**
 * Convert markdown-it inline tokens to formatted text/link nodes.
 * markdown-it encodes inline formatting with open/close TOKENS (not
 * children), so we maintain a format stack while walking the token list.
 */
interface InlineToken {
  type: string;
  content?: string | null;
  children?: unknown[] | null;
  attrs?: Array<[string, string | null]>;
}

function convertInline(tokens: readonly InlineToken[], acc: MdNode[]): void {
  const stack: number[] = [0];

  const push = (text: string, format: number): void => pushText(acc, text, format);

  for (let i = 0; i < tokens.length; i++) {
    const raw = tokens[i];
    if (!raw) continue;
    const tok = raw as InlineToken;
    const current = stack[stack.length - 1] ?? 0;

    switch (tok.type) {
      case 'text':
        if (tok.content) push(tok.content, current);
        break;
      case 'code_inline':
        if (tok.content) push(tok.content, current | FMT_CODE);
        break;
      case 'strong_open':
        stack.push(current | FMT_BOLD);
        break;
      case 'strong_close':
        stack.pop();
        break;
      case 'em_open':
        stack.push(current | FMT_ITALIC);
        break;
      case 'em_close':
        stack.pop();
        break;
      case 's_open':
        stack.push(current | FMT_STRIKE);
        break;
      case 's_close':
        stack.pop();
        break;
      case 'u_open':
        stack.push(current | FMT_UNDERLINE);
        break;
      case 'u_close':
        stack.pop();
        break;
      case 'link_open': {
        const href = tok.attrs?.find(([name]) => name === 'href')?.[1];
        const safeHref = href && isSafeUrl(href) ? href : undefined;
        // Collect tokens until the matching link_close (nesting-aware).
        const innerTokens: Array<(typeof tokens)[number]> = [];
        let depth = 1;
        let j = i + 1;
        while (j < tokens.length && depth > 0) {
          const inner = tokens[j];
          if (!inner) break;
          if (inner.type === 'link_open') depth++;
          if (inner.type === 'link_close') {
            depth--;
            if (depth === 0) break;
          }
          innerTokens.push(inner);
          j++;
        }
        const linkChildren: MdNode[] = [];
        convertInline(innerTokens, linkChildren);
        if (safeHref && linkChildren.length > 0) {
          acc.push({ type: 'link', url: safeHref, children: linkChildren });
        } else {
          acc.push(...linkChildren);
        }
        i = j;
        break;
      }
      case 'image': {
        const src = tok.attrs?.find(([name]) => name === 'src')?.[1];
        const alt = tok.attrs?.find(([name]) => name === 'alt')?.[1] || '';
        if (src && isSafeUrl(src)) {
          acc.push({
            type: 'studio-card',
            cardType: 'image',
            cardData: { src, alt, width: 'regular' },
            version: 1,
          });
        }
        break;
      }
      case 'softbreak':
      case 'hardbreak':
        push(' ', current);
        break;
      default:
        break;
    }
  }
}

function toSerializable(node: MdNode): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === 'children') {
      out.children = (value as MdNode[]).map(toSerializable);
    } else {
      out[key] = value;
    }
  }
  return out;
}

/** Parse a ```vibress-card type="x" fence into a card node, or null. */
function parseCardFence(info: string, content: string): MdNode | null {
  const match = /^vibress-card type=["']([^"']+)["']$/.exec(info.trim());
  if (!match) return null;
  const cardType = match[1];
  let cardData: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      cardData = parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return { type: 'studio-card', cardType, cardData, version: 1 };
}

/**
 * Convert the documented `::vibress-card{type="x"}` fence into a markdown-it
 * fenced code block so it roundtrips through the parser.
 */
function preprocessCardFences(markdown: string): string {
  const lines = markdown.split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line === undefined) {
      i++;
      continue;
    }
    const match = /^::vibress-card\{type=["']([^"']+)["']\}$/.exec(line.trim());
    if (match && typeof match[1] === 'string') {
      const type = match[1];
      out.push('```vibress-card type="' + type + '"');
      i++;
      // Collect JSON until the closing ::vibress-card line.
      while (i < lines.length && (lines[i] ?? '').trim() !== '::vibress-card') {
        const bodyLine = lines[i];
        if (bodyLine !== undefined) out.push(bodyLine);
        i++;
      }
      out.push('```');
      i++; // skip closing ::vibress-card
    } else {
      out.push(line);
      i++;
    }
  }
  return out.join('\n');
}

/**
 * Import markdown into a Studio document. Raw HTML in markdown is disabled
 * (`html: false`) and all links are URL-validated, so malicious markdown
 * cannot inject markup into the document model.
 */
export function markdownToStudioDocument(markdown: string): StudioDocument {
  if (!markdown || typeof markdown !== 'string') {
    return createEmptyStudioDocument();
  }

  const normalized = preprocessCardFences(markdown);
  const tokens = mdParser.parse(normalized, {});
  const children: MdNode[] = [];
  const openListStack: Array<'bullet' | 'number'> = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i] as {
      type: string;
      content?: string;
      children?: unknown[] | null;
      tag?: string;
      info?: string;
      map?: [number, number] | null;
      hidden?: boolean;
    };

    switch (tok.type) {
      case 'paragraph_open': {
        const inline = tokens[i + 1];
        const close = tokens[i + 2];
        if (inline?.type === 'inline' && close?.type === 'paragraph_close') {
          const acc: MdNode[] = [];
          convertInline((inline.children || []) as InlineToken[], acc);
          if (acc.length > 0) children.push({ type: 'paragraph', children: acc });
          i += 2;
        }
        break;
      }
      case 'heading_open': {
        const level = Number(tok.tag?.replace('h', '') || '2');
        const inline = tokens[i + 1];
        if (inline?.type === 'inline') {
          const acc: MdNode[] = [];
          convertInline((inline.children || []) as InlineToken[], acc);
          children.push({ type: 'heading', tag: `h${Math.min(level, 6)}`, children: acc });
          i += 2; // skip inline + heading_close
        }
        break;
      }
      case 'blockquote_open': {
        const quoteChildren: MdNode[] = [];
        // Consume until blockquote_close (nested handled recursively below).
        let depth = 1;
        let j = i + 1;
        while (j < tokens.length && depth > 0) {
          const t = tokens[j];
          if (!t) break;
          if (t.type === 'blockquote_open') depth++;
          if (t.type === 'blockquote_close') {
            depth--;
            if (depth === 0) break;
          }
          convertMarkdownBlockTokens(tokens, j, quoteChildren, openListStack);
          j++;
        }
        children.push({ type: 'quote', children: quoteChildren });
        i = j;
        break;
      }
      case 'bullet_list_open':
      case 'ordered_list_open': {
        const listType = tok.type === 'ordered_list_open' ? 'number' : 'bullet';
        const listChildren: MdNode[] = [];
        let depth = 1;
        let j = i + 1;
        while (j < tokens.length && depth > 0) {
          const t = tokens[j];
          if (!t) break;
          if (t.type === 'bullet_list_open' || t.type === 'ordered_list_open') depth++;
          if (t.type === 'bullet_list_close' || t.type === 'ordered_list_close') {
            depth--;
            if (depth === 0) break;
          }
          convertMarkdownBlockTokens(tokens, j, listChildren, openListStack);
          j++;
        }
        children.push({ type: 'list', listType, children: listChildren });
        i = j;
        break;
      }
      case 'list_item_open': {
        const inline = tokens[i + 1];
        const acc: MdNode[] = [];
        if (inline?.type === 'inline') {
          convertInline((inline.children || []) as InlineToken[], acc);
        }
        children.push({ type: 'listitem', children: acc.length ? acc : [{ type: 'paragraph', children: [] }] });
        break;
      }
      case 'fence':
      case 'code_block': {
        const info = tok.info || '';
        const card = parseCardFence(info, tok.content || '');
        if (card) {
          children.push(card);
        } else {
          const lang = info.split(/\s+/)[0] || '';
          children.push({
            type: 'code',
            language: lang,
            children: [{ type: 'text', text: tok.content || '', format: 0, mode: 'normal', version: 1 }],
          });
        }
        break;
      }
      case 'hr':
        children.push({ type: 'studio-card', cardType: 'divider', cardData: { style: 'solid' }, version: 1 });
        break;
      case 'inline': {
        if (tok.content && tok.content.trim()) {
          const acc: MdNode[] = [];
          convertInline((tok.children || []) as InlineToken[], acc);
          if (acc.length > 0) children.push({ type: 'paragraph', children: acc });
        }
        break;
      }
      default:
        break;
    }
  }

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

function convertMarkdownBlockTokens(
  tokens: Array<{ type: string; content?: string; children?: unknown[] | null; tag?: string; info?: string }>,
  index: number,
  out: MdNode[],
  _stack: Array<'bullet' | 'number'>
): void {
  const tok = tokens[index];
  if (!tok) return;
  switch (tok.type) {
    case 'paragraph_open': {
      const inline = tokens[index + 1];
      if (inline?.type === 'inline') {
        const acc: MdNode[] = [];
        convertInline((inline.children || []) as InlineToken[], acc);
        if (acc.length > 0) out.push({ type: 'paragraph', children: acc });
      }
      break;
    }
    case 'heading_open': {
      const inline = tokens[index + 1];
      if (inline?.type === 'inline') {
        const acc: MdNode[] = [];
        convertInline((inline.children || []) as InlineToken[], acc);
        out.push({ type: 'heading', tag: tok.tag || 'h2', children: acc });
      }
      break;
    }
    case 'list_item_open': {
      const inline = tokens[index + 1];
      const acc: MdNode[] = [];
      if (inline?.type === 'inline') convertInline((inline.children || []) as InlineToken[], acc);
      out.push({ type: 'listitem', children: acc.length ? acc : [{ type: 'paragraph', children: [] }] });
      break;
    }
    case 'inline': {
      if (tok.content?.trim()) {
        const acc: MdNode[] = [];
        convertInline((tok.children || []) as InlineToken[], acc);
        if (acc.length > 0) out.push({ type: 'paragraph', children: acc });
      }
      break;
    }
    default:
      break;
  }
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

interface StudioMarkdownNode {
  type: string;
  text?: string;
  format?: number;
  children?: unknown[] | null;
  url?: string;
  tag?: string;
  cardType?: string;
  cardData?: { markdown?: string; html?: string; url?: string; text?: string; emoji?: string; heading?: string; content?: string; images?: Array<{ src?: string; alt?: string }>; [key: string]: unknown };
  [key: string]: unknown;
}

/**
 * Export a Studio document to markdown. Cards render to native markdown
 * where one exists; complex cards use the deterministic
 * `::vibress-card{type="..."}` fence.
 */
export function studioDocumentToMarkdown(docInput: unknown): string {
  const doc = migrateDocument(docInput);
  if (!doc.root || !Array.isArray(doc.root.children)) {
    return '';
  }

  return doc.root.children
    .map((node) => renderNodeToMarkdown(node as StudioMarkdownNode))
    .filter((s): s is string => !!s)
    .join('\n\n');
}

function renderNodeToMarkdown(node: StudioMarkdownNode): string {
  if (!node || typeof node !== 'object') return '';

  const type = node.type;

  if (type === 'text') {
    let text = node.text || '';
    const format = typeof node.format === 'number' ? node.format : 0;
    if (format & FMT_CODE) text = `\`${text}\``;
    if (format & FMT_BOLD) text = `**${text}**`;
    if (format & FMT_ITALIC) text = `*${text}*`;
    if (format & FMT_STRIKE) text = `~~${text}~~`;
    return text;
  }

  const renderChildren = (): string => {
    if (Array.isArray(node.children)) {
      return node.children.map((child) => renderNodeToMarkdown(child as StudioMarkdownNode)).join('');
    }
    return '';
  };

  switch (type) {
    case 'paragraph':
      return renderChildren();

    case 'heading': {
      const tag = (node.tag || 'h2').toLowerCase();
      const hashes = tag === 'h1' ? '#' : tag === 'h2' ? '##' : tag === 'h3' ? '###' : '####';
      return `${hashes} ${renderChildren()}`;
    }

    case 'quote':
      return renderChildren()
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');

    case 'list':
      return renderChildren();

    case 'listitem':
      return `- ${renderChildren()}`;

    case 'link': {
      const url = node.url || '#';
      return `[${renderChildren()}](${url})`;
    }

    case 'code':
      return `\`\`\`${(node.language as string) || ''}\n${renderChildren()}\n\`\`\``;

    case 'studio-card':
    case 'react-studio-card': {
      return cardToMarkdown(node);
    }

    default:
      return renderChildren();
  }
}

function cardToMarkdown(node: StudioMarkdownNode): string {
  const cardType = node.cardType || '';
  const data = node.cardData || {};

  switch (cardType) {
    case 'divider':
      return '---';

    case 'markdown':
      return data.markdown || '';

    case 'image': {
      const src = typeof data.src === 'string' ? data.src : '';
      const alt = typeof data.alt === 'string' ? data.alt : '';
      return src ? `![${alt}](${src})` : '';
    }

    case 'link':
    case 'bookmark': {
      const url = typeof data.url === 'string' ? data.url : '';
      const title = typeof data.title === 'string' && data.title ? data.title : url;
      return url ? `[${title}](${url})` : '';
    }

    case 'embed': {
      const url = typeof data.url === 'string' ? data.url : '';
      return url ? `[${url}](${url})` : '';
    }

    case 'callout': {
      const text = typeof data.text === 'string' ? data.text : '';
      const emoji = typeof data.emoji === 'string' && data.emoji ? data.emoji : '💡';
      return `> ${emoji} ${text}`;
    }

    case 'toggle': {
      const heading = typeof data.heading === 'string' ? data.heading : '';
      const content = typeof data.content === 'string' ? data.content : '';
      return `### ${heading}\n\n<details>\n\n${content}\n\n</details>`;
    }

    case 'gallery': {
      const images = Array.isArray(data.images) ? data.images : [];
      if (images.length > 0) {
        return images
          .map((img) => {
            const src = typeof img.src === 'string' ? img.src : '';
            const alt = typeof img.alt === 'string' ? img.alt : '';
            return src ? `![${alt}](${src})` : '';
          })
          .filter(Boolean)
          .join('\n');
      }
      return cardFence(cardType, data);
    }

    case 'html': {
      // Raw HTML cannot be represented as safe markdown; use the fence.
      return cardFence(cardType, data);
    }

    case 'button':
    case 'video':
    case 'audio':
    case 'file':
    default:
      return cardFence(cardType, data);
  }
}

function cardFence(cardType: string, data: Record<string, unknown>): string {
  let json: string;
  try {
    json = JSON.stringify(data);
  } catch {
    json = '{}';
  }
  return `${CARD_FENCE}{type="${cardType}"}\n${json}\n${CARD_FENCE}`;
}
