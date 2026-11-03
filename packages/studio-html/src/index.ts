import { StudioDocument, createDefaultStudioDocument, createEmptyStudioDocument } from '@vibress/studio-core';
import { sanitizeHtml } from '@vibress/studio-utils';
import { parseFragment, type DefaultTreeAdapterMap } from 'parse5';

type HtmlChild = DefaultTreeAdapterMap['childNode'];
type StudioNode = Record<string, unknown>;
type Direction = 'rtl' | 'ltr' | null;

function getDirection(node: HtmlChild, inherited: Direction): Direction {
  if (!('attrs' in node)) return inherited;
  const explicit = node.attrs.find(attr => attr.name === 'dir')?.value.toLowerCase();
  return explicit === 'rtl' || explicit === 'ltr' ? explicit : inherited;
}

function positiveSpan(node: HtmlChild, name: 'colspan' | 'rowspan'): number {
  if (!('attrs' in node)) return 1;
  const raw = node.attrs.find(attr => attr.name === name)?.value;
  if (!raw || !/^[0-9]+$/.test(raw)) return 1;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 && value <= 1000 ? value : 1;
}

function childrenOf(node: HtmlChild): HtmlChild[] {
  return 'childNodes' in node ? node.childNodes : [];
}

function inlineNodes(node: HtmlChild, format = 0): StudioNode[] {
  if ('value' in node && typeof node.value === 'string') {
    return node.value
      ? [{ type: 'text', text: node.value, format, detail: 0, mode: 'normal', style: '', version: 1 }]
      : [];
  }
  if (!('tagName' in node)) return childrenOf(node).flatMap(child => inlineNodes(child, format));
  const tag = node.tagName;
  if (tag === 'br') return [{ type: 'linebreak', version: 1 }];
  if (tag === 'img') {
    const src = node.attrs.find(attr => attr.name === 'src')?.value;
    if (!src) return [];
    const alt = node.attrs.find(attr => attr.name === 'alt')?.value ?? '';
    return [{ type: 'studio-card', cardType: 'image', cardData: { src, alt }, version: 1 }];
  }
  const nextFormat = format |
    (tag === 'strong' || tag === 'b' ? 1 : 0) |
    (tag === 'em' || tag === 'i' ? 2 : 0) |
    (tag === 's' || tag === 'del' || tag === 'strike' ? 4 : 0) |
    (tag === 'u' ? 8 : 0) |
    (tag === 'code' ? 16 : 0);
  const contents = childrenOf(node).flatMap(child => inlineNodes(child, nextFormat));
  if (tag === 'a') {
    const href = node.attrs.find(attr => attr.name === 'href')?.value;
    if (!href) return contents;
    return [{ type: 'link', url: href, format: '', indent: 0, direction: null, version: 1, children: contents }];
  }
  return contents;
}

function element(type: string, contents: StudioNode[], extra: StudioNode = {}): StudioNode {
  return { type, children: contents, direction: null, format: '', indent: 0, version: 1, ...extra };
}

const BLOCK_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
  'ul', 'ol', 'pre', 'hr', 'div', 'section', 'article', 'main',
  'header', 'footer', 'aside', 'figure', 'table',
]);

/** Keep adjacent inline nodes in the same paragraph, including formatting
 * inherited through span/strong/em wrappers. Flush before block children.
 */
function blocksFromChildren(nodes: HtmlChild[], direction: Direction = null): StudioNode[] {
  const blocks: StudioNode[] = [];
  let inline: StudioNode[] = [];
  const flush = () => {
    if (inline.some(part => part.type !== 'text' || (typeof part.text === 'string' && part.text.trim()))) {
      blocks.push(element('paragraph', inline, { direction }));
    }
    inline = [];
  };
  for (const child of nodes) {
    if ('tagName' in child && BLOCK_TAGS.has(child.tagName)) {
      flush();
      blocks.push(...blockNodes(child, direction));
    } else {
      inline.push(...inlineNodes(child));
    }
  }
  flush();
  return blocks;
}

/** Convert table rows and cells to Lexical-compatible nodes, preserving headers,
 * direction and supported spans. HTML parser may insert tbody automatically. */
function tableRows(node: HtmlChild, inherited: Direction): StudioNode[] {
  return childrenOf(node).flatMap(child => {
    if (!('tagName' in child)) return [];
    if (child.tagName === 'thead' || child.tagName === 'tbody' || child.tagName === 'tfoot') {
      return tableRows(child, getDirection(child, inherited));
    }
    if (child.tagName !== 'tr') return [];
    const direction = getDirection(child, inherited);
    const cells = childrenOf(child).flatMap(cell => {
      if (!('tagName' in cell) || (cell.tagName !== 'td' && cell.tagName !== 'th')) return [];
      const cellDirection = getDirection(cell, direction);
      const blocks = blocksFromChildren(childrenOf(cell), cellDirection);
      return [element('tablecell', blocks.length ? blocks : [element('paragraph', [], { direction: cellDirection })], {
        headerState: cell.tagName === 'th' ? 1 : 0,
        colSpan: positiveSpan(cell, 'colspan'),
        rowSpan: positiveSpan(cell, 'rowspan'),
        direction: cellDirection,
      })];
    });
    return cells.length ? [element('tablerow', cells, { direction })] : [];
  });
}

function blockNodes(node: HtmlChild, inherited: Direction = null): StudioNode[] {
  const direction = getDirection(node, inherited);
  if (!('tagName' in node)) {
    if ('value' in node && typeof node.value === 'string' && node.value.trim()) {
      return [element('paragraph', inlineNodes(node))];
    }
    return blocksFromChildren(childrenOf(node), direction);
  }
  const tag = node.tagName;
  if (/^h[1-6]$/.test(tag)) {
    return [element('heading', childrenOf(node).flatMap(child => inlineNodes(child)), { tag, direction })];
  }
  if (tag === 'p') return [element('paragraph', childrenOf(node).flatMap(child => inlineNodes(child)), { direction })];
  if (tag === 'blockquote') return [element('quote', childrenOf(node).flatMap(child => inlineNodes(child)), { direction })];
  if (tag === 'table') {
    return [element('table', tableRows(node, direction), { direction })];
  }
  if (tag === 'ul' || tag === 'ol') {
    const listType = tag === 'ol' ? 'number' : 'bullet';
    const items = childrenOf(node).filter(child => 'tagName' in child && child.tagName === 'li');
    const startAttribute = node.attrs.find(attr => attr.name === 'start')?.value;
    const parsedStart = startAttribute ? Number(startAttribute) : 1;
    const start = Number.isSafeInteger(parsedStart) && parsedStart > 0 ? parsedStart : 1;
    return [element('list', items.flatMap(item => blockNodes(item, direction)), { listType, tag, start, direction })];
  }
  if (tag === 'li') {
    const inline = childrenOf(node)
      .filter(child => !('tagName' in child && (child.tagName === 'ul' || child.tagName === 'ol')))
      .flatMap(child => inlineNodes(child));
    const nested = childrenOf(node)
      .filter(child => 'tagName' in child && (child.tagName === 'ul' || child.tagName === 'ol'))
      .flatMap(child => blockNodes(child, direction));
    return [element('listitem', [...inline, ...nested], { value: 1, direction })];
  }
  if (tag === 'pre') {
    return [element('code', childrenOf(node).flatMap(child => inlineNodes(child)))];
  }
  if (tag === 'hr') return [{ type: 'studio-card', cardType: 'divider', cardData: {}, version: 1 }];
  // A sanitized wrapper is flattened, without interpreting raw HTML as a node.
  return blocksFromChildren(childrenOf(node), direction);
}

/** Parse sanitized HTML into durable Lexical-compatible document nodes. */
export function htmlToStudioDocument(htmlInput: string): StudioDocument {
  if (!htmlInput || typeof htmlInput !== 'string') return createEmptyStudioDocument();
  const cleanHtml = sanitizeHtml(htmlInput.trim());
  if (!cleanHtml) return createEmptyStudioDocument();
  const children = blocksFromChildren(parseFragment(cleanHtml).childNodes);
  if (!children.length) {
    return createDefaultStudioDocument(cleanHtml.replace(/<[^>]+>/g, '').trim());
  }
  return {
    schema: 'vibress-studio',
    version: 1,
    editor: { lexicalVersion: '0.13.1' },
    root: { type: 'root', children, direction: null, format: '', indent: 0, version: 1 },
  };
}
