import {
  StudioDocument, createDefaultStudioDocument, createEmptyStudioDocument,
  checkDocumentResourceLimits, getUtf8ByteLength, resolveResourceLimits,
  StudioMigrationError, type DocumentResourceLimits,
} from '@vibress/studio-core';
import { sanitizeHtml, sanitizeInlineStyle } from '@vibress/studio-utils';
import { parseFragment, serialize, type DefaultTreeAdapterMap } from 'parse5';

type HtmlChild = DefaultTreeAdapterMap['childNode'];
type HtmlElement = DefaultTreeAdapterMap['element'];
type StudioNode = Record<string, unknown>;
type Direction = 'rtl' | 'ltr' | null;

function isElement(node: unknown): node is HtmlElement {
  return Boolean(node && typeof node === 'object' && 'tagName' in node && 'attrs' in node);
}

function getAttr(node: unknown, name: string): string | undefined {
  if (!isElement(node)) return undefined;
  return node.attrs.find(attr => attr.name === name)?.value;
}

function getDirection(node: HtmlChild, inherited: Direction): Direction {
  const explicit = getAttr(node, 'dir')?.toLowerCase();
  return explicit === 'rtl' || explicit === 'ltr' ? explicit : inherited;
}

function positiveSpan(node: HtmlChild, name: 'colspan' | 'rowspan'): number {
  const raw = getAttr(node, name);
  if (!raw || !/^[0-9]+$/.test(raw)) return 1;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= 1 && value <= 1000 ? value : 1;
}

/** Map supported sanitized CSS to fields that Lexical 0.14.3 actually round-trips.
 * Keep any other safe declarations as opaque style metadata so editable
 * admission intentionally rejects them instead of silently losing formatting. */
function editableBlockStyle(style: string, tableCell = false): StudioNode {
  if (!style) return {};
  const properties: StudioNode = {};
  const unsupported: string[] = [];
  for (const declaration of style.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    const name = declaration.slice(0, colon).trim();
    const value = declaration.slice(colon + 1).trim();
    if (name === 'text-align' && ['left', 'right', 'center', 'justify'].includes(value)) {
      properties.format = value;
    } else if (tableCell && name === 'background-color') {
      properties.backgroundColor = value;
    } else {
      unsupported.push(declaration.trim());
    }
  }
  if (unsupported.length > 0) properties.style = unsupported.join('; ');
  return properties;
}

function childrenOf(node: HtmlChild): HtmlChild[] {
  return 'childNodes' in node ? node.childNodes : [];
}

function extractHtmlChildText(node: HtmlChild): string {
  if ('value' in node && typeof node.value === 'string') {
    return node.value;
  }
  return childrenOf(node).map(extractHtmlChildText).join('');
}

function findImagesInFigure(figure: HtmlChild): Array<{ img: HtmlElement; href?: string }> {
  const results: Array<{ img: HtmlElement; href?: string }> = [];
  for (const child of childrenOf(figure)) {
    if (!isElement(child)) continue;
    if (child.tagName === 'img') {
      results.push({ img: child });
    } else if (child.tagName === 'a') {
      const href = getAttr(child, 'href');
      for (const grand of childrenOf(child)) {
        if (isElement(grand) && grand.tagName === 'img') {
          results.push({ img: grand, href });
        }
      }
    }
  }
  return results;
}

function inlineNodes(node: HtmlChild, format = 0): StudioNode[] {
  if ('value' in node && typeof node.value === 'string') {
    return node.value
      ? [{ type: 'text', text: node.value, format, detail: 0, mode: 'normal', style: '', version: 1 }]
      : [];
  }
  if (!isElement(node)) return childrenOf(node).flatMap(child => inlineNodes(child, format));
  const tag = node.tagName;
  if (tag === 'br') return [{ type: 'linebreak', version: 1 }];
  if (tag === 'img') {
    const src = getAttr(node, 'src');
    if (!src) return [];
    const alt = getAttr(node, 'alt') ?? '';
    return [{ type: 'studio-card', cardType: 'image', cardData: { src, alt }, version: 1 }];
  }
  const nextFormat = format |
    (tag === 'strong' || tag === 'b' ? 1 : 0) |
    (tag === 'em' || tag === 'i' ? 2 : 0) |
    (tag === 's' || tag === 'del' || tag === 'strike' ? 4 : 0) |
    (tag === 'u' ? 8 : 0) |
    (tag === 'code' ? 16 : 0);
  const contents = childrenOf(node).flatMap(child => inlineNodes(child, nextFormat));
  if (tag === 'span') {
    const rawStyle = getAttr(node, 'style');
    const safeStyle = rawStyle ? sanitizeInlineStyle(rawStyle) : '';
    if (safeStyle) {
      return contents.map(c => (c.type === 'text' ? { ...c, style: safeStyle } : c));
    }
  }
  if (tag === 'a') {
    const href = getAttr(node, 'href');
    const aChildren = childrenOf(node);
    const imgChild = aChildren.find(c => isElement(c) && c.tagName === 'img');
    if (imgChild && isElement(imgChild) && aChildren.length === 1) {
      const src = getAttr(imgChild, 'src');
      if (src) {
        const alt = getAttr(imgChild, 'alt') ?? '';
        return [{
          type: 'studio-card',
          cardType: 'image',
          cardData: { src, alt, ...(href ? { href } : {}) },
          version: 1,
        }];
      }
    }
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
  'header', 'footer', 'aside', 'figure', 'table', 'details', 'video', 'audio',
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
    if (isElement(child) && BLOCK_TAGS.has(child.tagName)) {
      flush();
      blocks.push(...blockNodes(child, direction));
    } else if (
      isElement(child) &&
      (child.tagName === 'img' || (child.tagName === 'a' && childrenOf(child).some(c => isElement(c) && c.tagName === 'img')))
    ) {
      flush();
      blocks.push(...inlineNodes(child));
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
    if (!isElement(child)) return [];
    if (child.tagName === 'thead' || child.tagName === 'tbody' || child.tagName === 'tfoot') {
      return tableRows(child, getDirection(child, inherited));
    }
    if (child.tagName !== 'tr') return [];
    const direction = getDirection(child, inherited);
    const cells = childrenOf(child).flatMap(cell => {
      if (!isElement(cell) || (cell.tagName !== 'td' && cell.tagName !== 'th')) return [];
      const explicitDir = getAttr(cell, 'dir')?.toLowerCase();
      const cellDirection = explicitDir === 'rtl' || explicitDir === 'ltr' ? explicitDir : null;
      const rawStyle = getAttr(cell, 'style');
      const safeStyle = rawStyle ? sanitizeInlineStyle(rawStyle) : '';
      const blocks = blocksFromChildren(childrenOf(cell), cellDirection || direction);
      return [element('tablecell', blocks.length ? blocks : [element('paragraph', [], { direction: cellDirection || direction })], {
        headerState: cell.tagName === 'th' ? 1 : 0,
        colSpan: positiveSpan(cell, 'colspan'),
        rowSpan: positiveSpan(cell, 'rowspan'),
        direction: cellDirection,
        ...editableBlockStyle(safeStyle, true),
      })];
    });
    return cells.length ? [element('tablerow', cells, { direction })] : [];
  });
}

function blockNodes(node: HtmlChild, inherited: Direction = null): StudioNode[] {
  const direction = getDirection(node, inherited);
  if (!isElement(node)) {
    if ('value' in node && typeof node.value === 'string' && node.value.trim()) {
      return [element('paragraph', inlineNodes(node))];
    }
    return blocksFromChildren(childrenOf(node), direction);
  }
  const tag = node.tagName;
  const rawStyle = getAttr(node, 'style');
  const safeStyle = rawStyle ? sanitizeInlineStyle(rawStyle) : '';
  const styleProp = editableBlockStyle(safeStyle);

  if (/^h[1-6]$/.test(tag)) {
    return [element('heading', childrenOf(node).flatMap(child => inlineNodes(child)), { tag, direction, ...styleProp })];
  }
  if (tag === 'p') {
    return [element('paragraph', childrenOf(node).flatMap(child => inlineNodes(child)), { direction, ...styleProp })];
  }
  if (tag === 'blockquote') {
    return [element('quote', childrenOf(node).flatMap(child => inlineNodes(child)), { direction, ...styleProp })];
  }
  if (tag === 'table') {
    return [element('table', tableRows(node, direction), { direction, ...styleProp })];
  }
  if (tag === 'ul' || tag === 'ol') {
    const listType = tag === 'ol' ? 'number' : 'bullet';
    const rawChildren = childrenOf(node);
    const items: HtmlChild[] = [];
    for (const child of rawChildren) {
      if (isElement(child)) {
        if (child.tagName === 'li') {
          items.push(child);
        } else if (child.tagName === 'ul' || child.tagName === 'ol') {
          // Wrap loose nested list in synthetic li
          items.push({
            nodeName: 'li',
            tagName: 'li',
            attrs: [],
            childNodes: [child],
            parentNode: node,
          } as unknown as HtmlChild);
        }
      }
    }
    const startAttribute = getAttr(node, 'start');
    const parsedStart = startAttribute ? Number(startAttribute) : 1;
    const start = Number.isSafeInteger(parsedStart) && parsedStart > 0 ? parsedStart : 1;
    return [element('list', items.flatMap(item => blockNodes(item, direction)), { listType, tag, start, direction, ...styleProp })];
  }
  if (tag === 'li') {
    const inline = childrenOf(node)
      .filter(child => !(isElement(child) && (child.tagName === 'ul' || child.tagName === 'ol')))
      .flatMap(child => inlineNodes(child));
    const nested = childrenOf(node)
      .filter(child => isElement(child) && (child.tagName === 'ul' || child.tagName === 'ol'))
      .flatMap(child => blockNodes(child, direction));
    return [element('listitem', [...inline, ...nested], { value: 1, direction, ...styleProp })];
  }
  if (tag === 'pre') {
    const codeChild = childrenOf(node).find(c => isElement(c) && c.tagName === 'code');
    const classAttr = (isElement(codeChild) ? getAttr(codeChild, 'class') : '') ||
                      getAttr(node, 'data-language') || '';
    const langMatch = classAttr.match(/(?:language-|lang-)?([a-zA-Z0-9_#-]+)/);
    const language = langMatch ? langMatch[1] : '';
    const inlines = codeChild ? childrenOf(codeChild).flatMap(child => inlineNodes(child)) : childrenOf(node).flatMap(child => inlineNodes(child));
    return [element('code', inlines, { ...(language ? { language } : {}), ...styleProp })];
  }
  if (tag === 'figure') {
    const classAttr = getAttr(node, 'class') || '';
    const figcaption = childrenOf(node).find(c => isElement(c) && c.tagName === 'figcaption');
    let caption = '';
    let captionHtml: string | undefined;
    if (figcaption && isElement(figcaption)) {
      caption = extractHtmlChildText(figcaption).trim();
      const inner = serialize(figcaption).trim();
      const clean = sanitizeHtml(inner);
      if (clean && /<[a-z][\s\S]*>/i.test(clean)) {
        captionHtml = clean;
      }
    }

    let width: 'regular' | 'wide' | 'full' | undefined;
    if (classAttr.includes('kg-width-full')) width = 'full';
    else if (classAttr.includes('kg-width-wide')) width = 'wide';

    // Gallery Card
    const images = findImagesInFigure(node);
    if (classAttr.includes('kg-gallery-card') || images.length > 1) {
      const galleryImages = images
        .map(({ img }) => {
          const src = getAttr(img, 'src') || '';
          const alt = getAttr(img, 'alt') || '';
          return { src, alt };
        })
        .filter(img => Boolean(img.src));

      if (galleryImages.length > 0) {
        return [{
          type: 'studio-card',
          cardType: 'gallery',
          cardData: {
            images: galleryImages,
            ...(caption ? { caption } : {}),
            ...(captionHtml ? { captionHtml } : {}),
            ...(width ? { width } : {}),
          },
          version: 1,
        }];
      }
    }

    // Video Card inside figure
    const videoNode = childrenOf(node).find(c => isElement(c) && c.tagName === 'video');
    if (videoNode && isElement(videoNode)) {
      const src = getAttr(videoNode, 'src');
      if (src) {
        const poster = getAttr(videoNode, 'poster');
        return [{
          type: 'studio-card',
          cardType: 'video',
          cardData: {
            src,
            ...(poster ? { poster } : {}),
            ...(caption ? { caption } : {}),
            ...(captionHtml ? { captionHtml } : {}),
            ...(width ? { width } : {}),
          },
          version: 1,
        }];
      }
    }

    // Bookmark Card
    if (classAttr.includes('kg-bookmark-card')) {
      const aNode = childrenOf(node).find(c => isElement(c) && c.tagName === 'a');
      if (aNode && isElement(aNode)) {
        const url = getAttr(aNode, 'href');
        if (url) {
          const titleEl = childrenOf(aNode).find(c => isElement(c) && (getAttr(c, 'class') || '').includes('title'));
          const descEl = childrenOf(aNode).find(c => isElement(c) && (getAttr(c, 'class') || '').includes('desc'));
          const title = titleEl ? extractHtmlChildText(titleEl).trim() : '';
          const description = descEl ? extractHtmlChildText(descEl).trim() : '';
          return [{
            type: 'studio-card',
            cardType: 'bookmark',
            cardData: {
              url,
              title: title || url,
              description,
            },
            version: 1,
          }];
        }
      }
    }

    // Embed Card inside figure
    if (classAttr.includes('kg-embed-card')) {
      const iframe = childrenOf(node).find(c => isElement(c) && c.tagName === 'iframe');
      const aNode = childrenOf(node).find(c => isElement(c) && c.tagName === 'a');
      const embedUrl = (iframe ? getAttr(iframe, 'src') : undefined) || (aNode ? getAttr(aNode, 'href') : undefined);
      if (embedUrl) {
        return [{
          type: 'studio-card',
          cardType: 'embed',
          cardData: {
            url: embedUrl,
            ...(caption ? { caption } : {}),
            ...(captionHtml ? { captionHtml } : {}),
          },
          version: 1,
        }];
      }
    }

    // Image Card (single image, possibly inside <a>)
    if (images.length === 1 && images[0]) {
      const { img, href } = images[0];
      const src = getAttr(img, 'src');
      if (src) {
        const alt = getAttr(img, 'alt') ?? '';
        const rawW = getAttr(img, 'width');
        const rawH = getAttr(img, 'height');
        const numW = rawW && /^\d+$/.test(rawW) ? Number(rawW) : undefined;
        const numH = rawH && /^\d+$/.test(rawH) ? Number(rawH) : undefined;
        return [{
          type: 'studio-card',
          cardType: 'image',
          cardData: {
            src,
            alt,
            ...(href ? { href } : {}),
            ...(caption ? { caption } : {}),
            ...(captionHtml ? { captionHtml } : {}),
            ...(width ? { width } : (numW ? { width: numW } : {})),
            ...(numH ? { height: numH } : {}),
          },
          version: 1,
        }];
      }
    }

    return blocksFromChildren(childrenOf(node), direction);
  }

  // Div-based publication cards
  if (tag === 'div') {
    const classAttr = getAttr(node, 'class') || '';

    // Callout Card
    if (classAttr.includes('kg-callout-card')) {
      const emojiEl = childrenOf(node).find(c => isElement(c) && (getAttr(c, 'class') || '').includes('emoji'));
      const contentEl = childrenOf(node).find(c => isElement(c) && (getAttr(c, 'class') || '').includes('content'));
      const emoji = emojiEl ? extractHtmlChildText(emojiEl).trim() : '💡';
      const text = contentEl ? extractHtmlChildText(contentEl).trim() : extractHtmlChildText(node).trim();
      const bgMatch = classAttr.match(/bg-([a-zA-Z0-9_-]+)/);
      const backgroundColor = bgMatch ? bgMatch[1] : 'grey';
      return [{
        type: 'studio-card',
        cardType: 'callout',
        cardData: { text, emoji: emoji || '💡', backgroundColor },
        version: 1,
      }];
    }

    // Button Card
    if (classAttr.includes('kg-button-card')) {
      const aNode = childrenOf(node).find(c => isElement(c) && c.tagName === 'a');
      if (aNode && isElement(aNode)) {
        const url = getAttr(aNode, 'href') || '#';
        const text = extractHtmlChildText(aNode).trim() || 'Button';
        const alignMatch = classAttr.match(/align-(left|center|right)/);
        const alignment = alignMatch ? (alignMatch[1] as 'left' | 'center' | 'right') : 'center';
        return [{
          type: 'studio-card',
          cardType: 'button',
          cardData: { text, url, alignment },
          version: 1,
        }];
      }
    }

    // Audio Card
    if (classAttr.includes('kg-audio-card')) {
      const audio = childrenOf(node).find(c => isElement(c) && c.tagName === 'audio');
      const src = audio ? getAttr(audio, 'src') : undefined;
      if (src) {
        const titleEl = childrenOf(node).find(c => isElement(c) && (getAttr(c, 'class') || '').includes('title'));
        const title = titleEl ? extractHtmlChildText(titleEl).trim() : '';
        const capEl = childrenOf(node).find(c => isElement(c) && (getAttr(c, 'class') || '').includes('studio-media-caption'));
        const caption = capEl ? extractHtmlChildText(capEl).trim() : '';
        return [{
          type: 'studio-card',
          cardType: 'audio',
          cardData: { src, title, caption },
          version: 1,
        }];
      }
    }

    // File Card
    if (classAttr.includes('kg-file-card')) {
      const aNode = childrenOf(node).find(c => isElement(c) && c.tagName === 'a');
      const src = aNode ? getAttr(aNode, 'href') : undefined;
      if (src) {
        const sizeEl = aNode ? childrenOf(aNode).find(c => isElement(c) && (getAttr(c, 'class') || '').includes('size')) : undefined;
        const sizeText = sizeEl ? extractHtmlChildText(sizeEl).replace(/[()]/g, '').trim() : '';
        const fullLinkText = aNode ? extractHtmlChildText(aNode).trim() : 'file';
        const fileName = sizeText ? fullLinkText.replace(`(${sizeText})`, '').trim() : fullLinkText;
        const capEl = childrenOf(node).find(c => isElement(c) && (getAttr(c, 'class') || '').includes('studio-media-caption'));
        const caption = capEl ? extractHtmlChildText(capEl).trim() : '';
        return [{
          type: 'studio-card',
          cardType: 'file',
          cardData: { src, fileName: fileName || 'file', fileSize: sizeText, caption },
          version: 1,
        }];
      }
    }
  }

  // Standalone video/audio tags
  if (tag === 'video') {
    const src = getAttr(node, 'src');
    if (src) {
      const poster = getAttr(node, 'poster');
      return [{
        type: 'studio-card',
        cardType: 'video',
        cardData: { src, ...(poster ? { poster } : {}) },
        version: 1,
      }];
    }
  }

  if (tag === 'audio') {
    const src = getAttr(node, 'src');
    if (src) {
      return [{
        type: 'studio-card',
        cardType: 'audio',
        cardData: { src },
        version: 1,
      }];
    }
  }

  if (tag === 'details') {
    const children = childrenOf(node);
    const summary = children.find(c => isElement(c) && c.tagName === 'summary');
    const title = summary ? extractHtmlChildText(summary).trim() || 'Details' : 'Details';
    const nonSummary = children.filter(c => !(isElement(c) && c.tagName === 'summary'));

    let content = '';
    if (nonSummary.length === 1 && isElement(nonSummary[0]) && nonSummary[0].tagName === 'div') {
      // Toggle card public renderer wraps content in a container <div>
      const rawHtml = serialize(nonSummary[0]).trim();
      content = sanitizeHtml(rawHtml).trim();
    } else if (nonSummary.length > 0) {
      // Multiple or direct children (e.g. <p>, <br>, text nodes)
      const rawHtml = serialize({ nodeName: '#document-fragment', childNodes: nonSummary } as unknown as HtmlElement).trim();
      content = sanitizeHtml(rawHtml).trim();
    }

    return [{
      type: 'studio-card',
      cardType: 'toggle',
      cardData: { heading: title, content },
      version: 1,
    }];
  }

  if (tag === 'hr') return [{ type: 'studio-card', cardType: 'divider', cardData: {}, version: 1 }];

  // Flatten sanitized wrappers without interpreting raw HTML as a node.
  return blocksFromChildren(childrenOf(node), direction);
}

/** Parse sanitized HTML into durable Lexical-compatible document nodes. */
export function htmlToStudioDocument(htmlInput: string, limits?: DocumentResourceLimits): StudioDocument {
  if (!htmlInput || typeof htmlInput !== 'string') return createEmptyStudioDocument();
  // Reject oversized source *before* HTML parsing/sanitization allocates a DOM.
  // Output is checked again below because small markup can expand into many AST nodes.
  const budget = resolveResourceLimits(limits);
  if (getUtf8ByteLength(htmlInput) > budget.maxSizeBytes) {
    throw new StudioMigrationError(
      'HTML import exceeds the configured document size limit.',
      htmlInput,
      'RESOURCE_LIMIT_EXCEEDED'
    );
  }
  const cleanHtml = sanitizeHtml(htmlInput.trim());
  if (!cleanHtml) return createEmptyStudioDocument();
  const children = blocksFromChildren(parseFragment(cleanHtml).childNodes);
  const doc: StudioDocument = !children.length
    ? createDefaultStudioDocument(cleanHtml.replace(/<[^>]+>/g, '').trim())
    : {
      schema: 'vibress-studio',
      version: 1,
      editor: { lexicalVersion: '0.13.1' },
      root: { type: 'root', children, direction: null, format: '', indent: 0, version: 1 },
    };
  checkDocumentResourceLimits(doc, limits);
  return doc;
}
