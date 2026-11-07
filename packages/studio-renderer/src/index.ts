import { migrateDocument } from '@vibress/studio-core';
import { STUDIO_CARD_DEFINITIONS, type StudioCardDefinition } from '@vibress/studio-card-definitions';
import { escapeHtml, sanitizeUrl, sanitizeStudioHtml, sanitizeInlineStyle, isSafeCssColor } from '@vibress/studio-utils';

export interface RenderOptions {
  target?: 'web' | 'email';
  /** Optional trusted in-process plugin registry providing custom card definitions. */
  pluginRegistry?: { getCard(type: string): StudioCardDefinition | undefined };
  /** Only include UI controls if host supplies a working client enhancement. */
  interactiveControls?: boolean;
}

export class HeadingSlugTracker {
  private nextSuffix = new Map<string, number>();
  private usedIds = new Set<string>();

  allocate(rawText: string): string {
    const trimmed = rawText.trim();
    let baseSlug = slugifyHeading(trimmed);
    if (!baseSlug && trimmed) baseSlug = 'heading';
    if (!baseSlug) return '';

    // An explicit heading "foo-1" can collide with a repeated "foo".
    // Reserve every emitted id, not just counters per normalized title.
    let suffix = this.nextSuffix.get(baseSlug) ?? 0;
    let candidate = suffix === 0 ? baseSlug : `${baseSlug}-${suffix}`;
    while (this.usedIds.has(candidate)) {
      suffix += 1;
      candidate = `${baseSlug}-${suffix}`;
    }
    this.nextSuffix.set(baseSlug, suffix + 1);
    this.usedIds.add(candidate);
    return candidate;
  }

  reset(): void {
    this.nextSuffix.clear();
    this.usedIds.clear();
  }
}

export function renderStudioDocumentToHtml(docInput: unknown, options: RenderOptions = {}): string {
  // migrateDocument applies the canonical normalization layer
  // (react-studio-card → studio-card) plus legacy migration.
  const doc = migrateDocument(docInput);
  if (!doc.root || !Array.isArray(doc.root.children)) {
    return '';
  }

  const slugTracker = new HeadingSlugTracker();
  const raw = doc.root.children.map((node) => renderNodeToHtml(node, options, slugTracker)).join('');

  // FINAL security boundary: every Studio card's rendered markup passes
  // through the shared allowlist sanitizer before leaving the server.
  // CSP remains a second, independent defense layer.
  return sanitizeStudioHtml(raw);
}

/** Lexical's built-in TableNode can discard its own direction on import.
 * Direction retained by descendant elements is authoritative for rendering
 * when the table node itself has no explicit value.
 */
function firstChildDirection(node: unknown): 'ltr' | 'rtl' | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const direction = firstChildDirection(child);
      if (direction) return direction;
    }
    return null;
  }
  if (!node || typeof node !== 'object') return null;
  const current = node as { direction?: unknown; children?: unknown[] };
  if (current.direction === 'rtl' || current.direction === 'ltr') return current.direction;
  if (Array.isArray(current.children)) {
    for (const child of current.children) {
      const direction = firstChildDirection(child);
      if (direction) return direction;
    }
  }
  return null;
}

/** Include Lexical's canonical block alignment in published HTML.
 * Unsupported opaque style remains sanitized, never executed. */
function elementStyleAttr(node: Record<string, unknown>, extra = ''): string {
  const safeStyle = typeof node.style === 'string' && node.style.trim()
    ? sanitizeInlineStyle(node.style)
    : '';
  const alignment = typeof node.format === 'string' &&
    ['left', 'right', 'center', 'justify'].includes(node.format)
    ? `text-align: ${node.format}`
    : '';
  const style = [extra, safeStyle, alignment].filter(Boolean).join('; ');
  return style ? ` style="${escapeHtml(style)}"` : '';
}

function mergeOrderedListItems(children: unknown[]): unknown[] {
  const items: unknown[] = [];
  let previous: { children: unknown[] } | undefined;
  for (const child of children) {
    // Lexical stores nested lists in a separate listitem wrapper. Attach it
    // to its parent item so the browser does not count the wrapper as a step.
    if (isListItem(child) && previous && child.children.length > 0 &&
        child.children.every((node) => typeof node === "object" && node !== null &&
          "type" in node && node.type === "list")) {
      previous.children.push(...child.children);
      continue;
    }
    previous = isListItem(child) ? { ...child, children: [...child.children] } : undefined;
    items.push(previous ?? child);
  }
  return items;
}

function isListItem(node: unknown): node is { type: "listitem"; children: unknown[] } {
  return typeof node === "object" && node !== null && "type" in node &&
    node.type === "listitem" && "children" in node && Array.isArray(node.children);
}

function renderNodeToHtml(node: unknown, options: RenderOptions, slugTracker?: HeadingSlugTracker | Map<string, number>): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as Record<string, unknown>;

  const type = n.type;
  const directionAttr = n.direction === 'rtl' || n.direction === 'ltr'
    ? ` dir="${n.direction}"`
    : '';

  // Handle TextNode
  if (type === 'text') {
    const rawText = typeof n.text === 'string' ? n.text : (n.text != null && typeof n.text !== 'object' ? String(n.text) : '');
    let text = escapeHtml(rawText);
    const format = typeof n.format === 'number' && Number.isFinite(n.format) ? n.format : 0;

    // Lexical format bitmask: 1=Bold, 2=Italic, 4=Strikethrough, 8=Underline, 16=Code, 32=Subscript, 64=Superscript
    if (format & 16) text = `<code>${text}</code>`;
    if (format & 1) text = `<strong>${text}</strong>`;
    if (format & 2) text = `<em>${text}</em>`;
    if (format & 4) text = `<s>${text}</s>`;
    if (format & 8) text = `<u>${text}</u>`;
    if (format & 32) text = `<sub>${text}</sub>`;
    if (format & 64) text = `<sup>${text}</sup>`;

    if (typeof n.style === 'string' && n.style.trim()) {
      const safeStyle = sanitizeInlineStyle(n.style);
      if (safeStyle) {
        text = `<span style="${escapeHtml(safeStyle)}">${text}</span>`;
      }
    }

    return text;
  }

  // Render children helper
  const renderChildren = () => {
    if (Array.isArray(n.children)) {
      return n.children.map((child: unknown) => renderNodeToHtml(child, options, slugTracker)).join('');
    }
    return '';
  };

  // Handle Element Nodes
  switch (type) {
    case 'linebreak':
      return '<br />';

    case 'paragraph': {
      const content = renderChildren();
      // Block-level cards must never be wrapped in <p> (invalid HTML that
      // the final sanitizer would split, leaving stray empty <p> nodes).
      const hasBlockCard = Array.isArray(n.children) && n.children.some(
        (child: unknown) =>
          child && typeof child === 'object' &&
          ((child as { type?: string }).type === 'studio-card')
      );
      if (hasBlockCard) return content;
      const styleAttr = elementStyleAttr(n);
      return content ? `<p${directionAttr}${styleAttr}>${content}</p>` : `<p${directionAttr}></p>`;
    }

    case 'heading': {
      const rawTag = typeof n.tag === 'string' ? n.tag.toLowerCase().trim() : '';
      const level = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(rawTag)
        ? rawTag
        : 'h2';
      const styleAttr = elementStyleAttr(n);
      const childrenHtml = renderChildren();
      const rawText = extractNodeText(n).trim();
      let slug = '';
      if (slugTracker instanceof HeadingSlugTracker) {
        slug = slugTracker.allocate(rawText);
      } else if (slugTracker instanceof Map) {
        let baseSlug = slugifyHeading(rawText);
        if (!baseSlug && rawText) baseSlug = 'heading';
        if (baseSlug) {
          const count = slugTracker.get(baseSlug) || 0;
          slugTracker.set(baseSlug, count + 1);
          slug = count > 0 ? `${baseSlug}-${count}` : baseSlug;
        }
      } else {
        slug = slugifyHeading(rawText);
      }
      const idAttr = slug ? ` id="${escapeHtml(slug)}"` : '';
      // A permalink is keyboard-focusable: never hide it from the accessibility tree.
      // The label uses the visible heading text and remains safe for Arabic/mixed script.
      const headingLabel = rawText.length > 120 ? `${rawText.slice(0, 120)}…` : rawText;
      const anchor = slug
        ? `<a href="#${escapeHtml(slug)}" class="heading-anchor" aria-label="Link to section: ${escapeHtml(headingLabel)}">#</a>`
        : '';
      return `<${level}${idAttr}${directionAttr}${styleAttr}>${childrenHtml}${anchor}</${level}>`;
    }

    case 'quote':
      return `<blockquote${directionAttr}${elementStyleAttr(n)}>${renderChildren()}</blockquote>`;

    case 'list': {
      if (n.listType === 'check') {
        return `<ul class="studio-checklist"${directionAttr}${elementStyleAttr(n)}>${renderChildren()}</ul>`;
      }
      const listType = n.listType === 'number' ? 'ol' : 'ul';
      const startAttr = listType === 'ol' && typeof n.start === 'number' && Number.isSafeInteger(n.start) && n.start > 1
        ? ` start="${n.start}"` : '';
      const children = Array.isArray(n.children) ? n.children : [];
      const items = listType === 'ol' ? mergeOrderedListItems(children) : children;
      return `<${listType}${startAttr}${directionAttr}${elementStyleAttr(n)}>${items.map(item => renderNodeToHtml(item, options, slugTracker)).join('')}</${listType}>`;
    }

    case 'listitem': {
      if (typeof n.checked === 'boolean') {
        const isChecked = n.checked;
        const checkedAttr = isChecked ? ' checked="checked"' : '';
        const checkedClass = isChecked ? ' is-checked' : '';
        return `<li class="studio-checklist-item${checkedClass}"${directionAttr}${elementStyleAttr(n)}><input type="checkbox"${checkedAttr} disabled /><span>${renderChildren()}</span></li>`;
      }
      return `<li${directionAttr}${elementStyleAttr(n)}>${renderChildren()}</li>`;
    }

    case 'table': {
      const inferred = directionAttr ? '' : firstChildDirection(n.children);
      const tableDirection = directionAttr || (inferred ? ` dir="${inferred}"` : '');
      return `<div class="studio-table-container"><table class="studio-table"${tableDirection}${elementStyleAttr(n)}><tbody>${renderChildren()}</tbody></table></div>`;
    }

    case 'tablerow':
      return `<tr>${renderChildren()}</tr>`;

    case 'tablecell': {
      const isHeader = Boolean(n.headerState && n.headerState !== 0);
      const tag = isHeader ? 'th' : 'td';
      const colSpanVal = typeof n.colSpan === 'number' && Number.isInteger(n.colSpan) && n.colSpan > 1
        ? n.colSpan
        : (typeof n.colSpan === 'string' && /^\d+$/.test(n.colSpan) && parseInt(n.colSpan, 10) > 1 ? parseInt(n.colSpan, 10) : null);
      const rowSpanVal = typeof n.rowSpan === 'number' && Number.isInteger(n.rowSpan) && n.rowSpan > 1
        ? n.rowSpan
        : (typeof n.rowSpan === 'string' && /^\d+$/.test(n.rowSpan) && parseInt(n.rowSpan, 10) > 1 ? parseInt(n.rowSpan, 10) : null);
      const colSpan = colSpanVal ? ` colspan="${colSpanVal}"` : '';
      const rowSpan = rowSpanVal ? ` rowspan="${rowSpanVal}"` : '';
      const backgroundColor = typeof n.backgroundColor === 'string' && isSafeCssColor(n.backgroundColor)
        ? `background-color: ${n.backgroundColor}`
        : '';
      const bg = elementStyleAttr(n, backgroundColor);
      return `<${tag}${colSpan}${rowSpan}${bg}${directionAttr}>${renderChildren()}</${tag}>`;
    }

    case 'link': {
      const rawUrl = typeof n.url === 'string' ? n.url : '#';
      const url = sanitizeUrl(rawUrl);
      const target = typeof n.target === 'string' && n.target.trim() ? n.target.trim().toLowerCase() : '';
      let rel = typeof n.rel === 'string' && n.rel.trim() ? n.rel.trim() : '';
      if (target === '_blank') {
        const tokens = new Set(rel.toLowerCase().split(/\s+/).filter(Boolean));
        tokens.add('noopener');
        tokens.add('noreferrer');
        rel = Array.from(tokens).join(' ');
      }
      const relAttr = rel ? ` rel="${escapeHtml(rel)}"` : '';
      const targetAttr = target ? ` target="${escapeHtml(target)}"` : '';
      return `<a href="${url}"${relAttr}${targetAttr}>${renderChildren()}</a>`;
    }

    case 'code': {
      const rawLang = typeof n.language === 'string' ? n.language.trim() : '';
      const safeLang = rawLang.replace(/[^a-zA-Z0-9_#-]/g, '');
      const langAttr = safeLang ? ` data-language="${escapeHtml(safeLang)}"` : '';
      const codeHtml = renderChildren();
      const copyBtn = options.interactiveControls
        ? '<button type="button" class="studio-code-copy-btn" aria-label="Copy code">Copy</button>'
        : '';
      return `<div class="studio-code-block"${langAttr}${elementStyleAttr(n)}><div class="studio-code-header"><span class="studio-code-lang">${escapeHtml(safeLang || 'code')}</span>${copyBtn}</div><pre><code>${codeHtml}</code></pre></div>`;
    }

    // Handle Studio Card Nodes (canonical type after normalization)
    case 'studio-card': {
      const cardType = typeof n.cardType === 'string' ? n.cardType : '';
      const cardData = typeof n.cardData === 'object' && n.cardData !== null && !Array.isArray(n.cardData)
        ? (n.cardData as Record<string, unknown>)
        : {};
      // A blob: URL only exists for the current browser session and can never
      // be published; skip the card rather than emit a broken/leaky reference.
      if (hasTransientMedia(cardData)) {
        return `<!-- Card skipped: ${escapeHtml(cardType || 'card')} (transient media) -->`;
      }
      const def = cardType ? (STUDIO_CARD_DEFINITIONS[cardType] || options.pluginRegistry?.getCard(cardType)) : undefined;
      if (def) {
        try {
          const validated = def.validate(cardData);
          const html = def.renderHtml(validated);
          return typeof html === 'string' ? html : '';
        } catch {
          return `<!-- Error rendering card: ${escapeHtml(cardType || '')} -->`;
        }
      }
      return `<!-- Unknown card: ${escapeHtml(cardType || '')} -->`;
    }

    default:
      // Unknown element node fallback: render children if available
      return renderChildren();
  }
}

export function renderStudioDocumentToPlainText(docInput: unknown, options: RenderOptions = {}): string {
  const doc = migrateDocument(docInput);
  if (!doc.root || !Array.isArray(doc.root.children)) {
    return '';
  }

  return doc.root.children
    .map((node) => renderNodeToPlainText(node, options))
    .filter(Boolean)
    .join('\n\n');
}

function hasTransientMedia(cardData: Record<string, unknown>): boolean {
  const candidates: Array<unknown> = [cardData.src, cardData.poster, cardData.thumbnail];
  if (Array.isArray(cardData.images)) {
    for (const img of cardData.images) {
      if (img && typeof img === 'object') {
        candidates.push((img as Record<string, unknown>).src);
      }
    }
  }
  return candidates.some((v) => typeof v === 'string' && (v as string).toLowerCase().startsWith('blob:'));
}

function renderNodeToPlainText(node: unknown, options: RenderOptions = {}): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as Record<string, unknown>;

  if (n.type === 'text') {
    return typeof n.text === 'string' ? n.text : (n.text != null && typeof n.text !== 'object' ? String(n.text) : '');
  }

  if (n.type === 'studio-card') {
    const cardType = typeof n.cardType === 'string' ? n.cardType : '';
    const cardData = typeof n.cardData === 'object' && n.cardData !== null && !Array.isArray(n.cardData)
      ? (n.cardData as Record<string, unknown>)
      : {};
    // Transient blob: media must never surface in excerpts/search text.
    if (hasTransientMedia(cardData)) {
      return '';
    }
    const def = cardType ? (STUDIO_CARD_DEFINITIONS[cardType] || options.pluginRegistry?.getCard(cardType)) : undefined;
    if (def) {
      try {
        const validated = def.validate(cardData);
        const text = def.renderPlainText(validated);
        return typeof text === 'string' ? text : '';
      } catch {
        return '';
      }
    }
    return '';
  }

  if (n.type === 'list') {
    const isNumbered = n.listType === 'number';
    const isCheck = n.listType === 'check';
    const start = typeof n.start === 'number' && Number.isSafeInteger(n.start) && n.start > 0 ? n.start : 1;
    if (Array.isArray(n.children)) {
      return n.children
        .map((child, idx) => {
          const itemText = renderNodeToPlainText(child, options).trim();
          if (!itemText) return '';
          const prefix = isNumbered ? `${start + idx}. ` : (isCheck ? '' : '• ');
          return `${prefix}${itemText}`;
        })
        .filter(Boolean)
        .join('\n');
    }
    return '';
  }

  if (n.type === 'listitem') {
    const content = Array.isArray(n.children)
      ? n.children.map((c) => renderNodeToPlainText(c, options)).join('')
      : '';
    if (typeof n.checked === 'boolean') {
      const check = n.checked ? '[x] ' : '[ ] ';
      return `${check}${content.trim()}`;
    }
    return content;
  }

  if (n.type === 'table') {
    if (Array.isArray(n.children)) {
      return n.children
        .map((row) => renderNodeToPlainText(row, options).trim())
        .filter(Boolean)
        .join('\n');
    }
    return '';
  }

  if (n.type === 'tablerow') {
    if (Array.isArray(n.children)) {
      return n.children
        .map((cell) => renderNodeToPlainText(cell, options).trim())
        .filter(Boolean)
        .join('\t');
    }
    return '';
  }

  if (n.type === 'tablecell') {
    if (Array.isArray(n.children)) {
      return n.children
        .map((c) => renderNodeToPlainText(c, options).trim())
        .filter(Boolean)
        .join(' ');
    }
    return '';
  }

  if (n.type === 'quote') {
    const text = Array.isArray(n.children)
      ? n.children.map((c) => renderNodeToPlainText(c, options)).join('')
      : '';
    return text.trim();
  }

  if (Array.isArray(n.children)) {
    return n.children.map((child: unknown) => renderNodeToPlainText(child, options)).join('');
  }

  return '';
}

export function extractNodeText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const n = node as { type?: unknown; text?: unknown; children?: unknown };
  if (n.type === 'text') {
    return typeof n.text === 'string' ? n.text : (n.text != null && typeof n.text !== 'object' ? String(n.text) : '');
  }
  if (Array.isArray(n.children)) {
    return n.children.map(extractNodeText).join('');
  }
  return '';
}

export function slugifyHeading(text: string): string {
  if (typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .replace(/<[^>]*>?/gm, '')
    .replace(/[^\w\s\u0600-\u06FF-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export interface TableOfContentsItem {
  id: string;
  text: string;
  level: number;
}

export function extractTableOfContentsFromDocument(docInput: unknown): TableOfContentsItem[] {
  const doc = migrateDocument(docInput);
  if (!doc.root || !Array.isArray(doc.root.children)) {
    return [];
  }

  const items: TableOfContentsItem[] = [];
  const slugTracker = new HeadingSlugTracker();

  function walk(node: unknown): void {
    if (!node || typeof node !== 'object') return;
    const n = node as { type?: unknown; tag?: unknown; children?: unknown };
    if (n.type === 'heading') {
      const rawTag = typeof n.tag === 'string' ? n.tag.toLowerCase().trim() : 'h2';
      const tag = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(rawTag) ? rawTag : 'h2';
      const rawText = extractNodeText(n).trim();
      const slug = slugTracker.allocate(rawText);
      if (['h2', 'h3'].includes(tag) && rawText && slug) {
        items.push({
          id: slug,
          text: rawText,
          level: tag === 'h2' ? 2 : 3,
        });
      }
      return;
    }
    if (Array.isArray(n.children)) {
      for (const child of n.children) {
        walk(child);
      }
    }
  }

  for (const child of doc.root.children) {
    walk(child);
  }

  return items;
}
