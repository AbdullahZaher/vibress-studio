import { StudioDocument, createDefaultStudioDocument, createEmptyStudioDocument } from '@vibress/studio-core';
import { sanitizeHtml } from '@vibress/studio-utils';
import { parseFragment } from 'parse5';

type HtmlChild = ReturnType<typeof parseFragment>['childNodes'][number];
type StudioNode = Record<string, unknown>;

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

function blockNodes(node: HtmlChild): StudioNode[] {
  if (!('tagName' in node)) {
    if ('value' in node && typeof node.value === 'string' && node.value.trim()) {
      return [element('paragraph', inlineNodes(node))];
    }
    return childrenOf(node).flatMap(blockNodes);
  }
  const tag = node.tagName;
  if (/^h[1-6]$/.test(tag)) {
    return [element('heading', childrenOf(node).flatMap(child => inlineNodes(child)), { tag })];
  }
  if (tag === 'p') return [element('paragraph', childrenOf(node).flatMap(child => inlineNodes(child)))];
  if (tag === 'blockquote') return [element('quote', childrenOf(node).flatMap(child => inlineNodes(child)))];
  if (tag === 'ul' || tag === 'ol') {
    const listType = tag === 'ol' ? 'number' : 'bullet';
    const items = childrenOf(node).filter(child => 'tagName' in child && child.tagName === 'li');
    const startAttribute = node.attrs.find(attr => attr.name === 'start')?.value;
    const parsedStart = startAttribute ? Number(startAttribute) : 1;
    const start = Number.isSafeInteger(parsedStart) && parsedStart > 0 ? parsedStart : 1;
    return [element('list', items.flatMap(blockNodes), { listType, tag, start })];
  }
  if (tag === 'li') {
    const inline = childrenOf(node)
      .filter(child => !('tagName' in child && (child.tagName === 'ul' || child.tagName === 'ol')))
      .flatMap(child => inlineNodes(child));
    const nested = childrenOf(node)
      .filter(child => 'tagName' in child && (child.tagName === 'ul' || child.tagName === 'ol'))
      .flatMap(blockNodes);
    return [element('listitem', [...inline, ...nested], { value: 1 })];
  }
  if (tag === 'pre') {
    return [element('code', childrenOf(node).flatMap(child => inlineNodes(child)))];
  }
  if (tag === 'hr') return [{ type: 'studio-card', cardType: 'divider', cardData: {}, version: 1 }];
  // A sanitized wrapper is flattened, without interpreting raw HTML as a node.
  return childrenOf(node).flatMap(blockNodes);
}

/** Parse sanitized HTML into durable Lexical-compatible document nodes. */
export function htmlToStudioDocument(htmlInput: string): StudioDocument {
  if (!htmlInput || typeof htmlInput !== 'string') return createEmptyStudioDocument();
  const cleanHtml = sanitizeHtml(htmlInput.trim());
  if (!cleanHtml) return createEmptyStudioDocument();
  const children = parseFragment(cleanHtml).childNodes.flatMap(blockNodes);
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
