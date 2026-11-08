import { parseFragment, serialize } from 'parse5';

/**
 * Shared Studio HTML sanitizer.
 *
 * This is a real HTML-parser-based allowlist sanitizer (parse5), NOT a
 * regex-based filter. It walks the parsed tree, drops disallowed elements and
 * attributes, neutralizes unsafe URLs, and re-serializes the result.
 *
 * It is the FINAL security boundary for every Studio card's public HTML:
 * card renderers produce semantic markup, and this sanitizer guarantees the
 * output contains no script execution vectors regardless of card input
 * (especially the privileged HTML card).
 */

export const STUDIO_ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'del', 'strike', 'sub', 'sup', 'mark', 'small',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'img', 'figure', 'figcaption',
  'video', 'audio', 'source',
  'details', 'summary',
  'div', 'span', 'hr', 'section', 'article', 'main', 'header', 'footer', 'aside',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'iframe',
  'input',
  'button',
]);

const GLOBAL_ATTRS = new Set([
  'class', 'id', 'dir', 'lang', 'title', 'style',
  'data-checked', 'data-language', 'aria-label', 'aria-hidden', 'aria-expanded'
]);

/** Tag → allowed attributes (beyond GLOBAL_ATTRS). */
const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(['href', 'target', 'rel', 'download']),
  img: new Set(['src', 'alt', 'width', 'height', 'loading']),
  video: new Set(['src', 'poster', 'controls', 'preload', 'loop', 'muted', 'playsinline', 'width', 'height']),
  audio: new Set(['src', 'controls', 'preload', 'loop']),
  source: new Set(['src', 'type']),
  iframe: new Set(['src', 'title', 'loading', 'allow', 'allowfullscreen']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
  ol: new Set(['start', 'type']),
  input: new Set(['type', 'checked', 'disabled']),
  button: new Set(['type', 'disabled', 'aria-label', 'aria-expanded']),
};

const URL_ATTRS = new Set(['href', 'src', 'poster']);
const SAFE_DATA_IMAGE_RE = /^data:image\/(png|jpe?g|gif|webp|avif);base64,/i;

export interface StudioUrlOptions {
  allowDataImages?: boolean;
  /** Optional host-specific URL length budget; no implicit truncation. */
  maxLength?: number;
}

/** Different destinations have different protocol contracts. A safe mail
 * link is not a media source; inline raster data is opt-in for HTML images. */
export function isSafeStudioUrl(value: unknown, context: 'link' | 'image' | 'media', options: StudioUrlOptions = {}): value is string {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f\u007f-\u009f\\]/.test(value)) return false;
  if (options.maxLength !== undefined && (!Number.isFinite(options.maxLength) || options.maxLength <= 0 || value.length > options.maxLength)) return false;
  if (!isSafeProtocolUrl(value)) return false;
  const url = value.trim();
  if (SAFE_DATA_IMAGE_RE.test(url)) return context === 'image' && options.allowDataImages === true;
  if (context !== 'link' && url.startsWith('#')) return false;
  try {
    const parsed = new URL(url, 'https://studio.invalid/');
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ||
      (context === 'link' && (parsed.protocol === 'mailto:' || parsed.protocol === 'tel:'));
  } catch { return false; }
}

export const ALLOWED_REL_TOKENS = new Set([
  'noopener',
  'noreferrer',
  'nofollow',
  'ugc',
  'sponsored',
  'external',
  'help',
  'license',
  'next',
  'prev',
  'tag',
]);

/**
 * Reject dangerous URL schemes. `blob:` is never safe in persisted/published
 * content (it only exists for the current browser session).
 */
export function isSafeProtocolUrl(url: string): boolean {
  if (typeof url !== 'string') return false;
  const decoded = url.trim().replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&colon;?/gi, ':')
    .replace(/&tab;?/gi, '')
    .replace(/&newline;?/gi, '');
  const stripped = decoded.replace(/[\u0000-\u001f\u007f-\u009f\s]+/g, '').toLowerCase();

  if (
    stripped.startsWith('javascript:') ||
    stripped.startsWith('vbscript:') ||
    stripped.startsWith('file:') ||
    stripped.startsWith('blob:')
  ) {
    return false;
  }
  if (
    stripped.startsWith('http://') ||
    stripped.startsWith('https://') ||
    stripped.startsWith('mailto:') ||
    stripped.startsWith('tel:')
  ) {
    return true;
  }
  if (url.trim().startsWith('/') || url.trim().startsWith('#') || url.trim() === '') {
    return true;
  }
  // data: images only for a small allowlist of raster formats (no SVG — SVG
  // can carry script inside <script>).
  if (SAFE_DATA_IMAGE_RE.test(url.trim())) {
    return true;
  }
  // Scheme-less relative references ("example.com/path").
  if (!stripped.includes(':')) {
    return true;
  }
  return false;
}

/** Approved embed providers (see getEmbedProvider). */
const EMBED_HOSTS = new Set([
  'youtube.com', 'm.youtube.com', 'youtu.be',
  'youtube-nocookie.com',
  'vimeo.com', 'player.vimeo.com',
]);

export type EmbedProviderKind = 'youtube' | 'vimeo';

/**
 * Validate a URL against the embed provider allowlist and return the
 * canonical iframe URL, or null when the URL is not an approved provider.
 */
export function getEmbedProvider(url: string): { kind: EmbedProviderKind; embedUrl: string } | null {
  if (typeof url !== 'string' || !url.trim()) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  let host = u.hostname.toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  if (host === 'youtu.be') {
    const id = u.pathname.slice(1);
    if (!id) return null;
    return { kind: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const id = u.searchParams.get('v');
    if (id) return { kind: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
    const m = u.pathname.match(/^\/embed\/([\w-]+)/);
    if (m) return { kind: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${m[1]}` };
    return null;
  }
  if (host === 'youtube-nocookie.com') {
    const m = u.pathname.match(/^\/embed\/([\w-]+)/);
    if (m) return { kind: 'youtube', embedUrl: `https://www.youtube-nocookie.com/embed/${m[1]}` };
    return null;
  }
  if (host === 'vimeo.com') {
    const m = u.pathname.match(/^\/(\d+)/);
    if (m) return { kind: 'vimeo', embedUrl: `https://player.vimeo.com/video/${m[1]}` };
    return null;
  }
  if (host === 'player.vimeo.com') {
    const m = u.pathname.match(/^\/video\/(\d+)/);
    if (m) return { kind: 'vimeo', embedUrl: `https://player.vimeo.com/video/${m[1]}` };
    return null;
  }
  return null;
}

export type StudioEmbedDestination =
  | { kind: 'iframe'; url: string }
  | { kind: 'external-link'; url: string }
  | { kind: 'invalid' };

/** Shared source of truth for editor previews and published embed output. */
export function resolveStudioEmbedDestination(input: unknown): StudioEmbedDestination {
  if (typeof input !== 'string' || !input.trim()) return { kind: 'invalid' };
  if (/[\u0000-\u001f\u007f\\\\]/.test(input)) return { kind: 'invalid' };
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    return { kind: 'invalid' };
  }
  if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) {
    return { kind: 'invalid' };
  }
  const provider = getEmbedProvider(parsed.href);
  if (provider) return { kind: 'iframe', url: provider.embedUrl };
  return { kind: 'external-link', url: parsed.href };
}

export function isAllowedEmbedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^www\./, '');
  return EMBED_HOSTS.has(h);
}

function isAllowedIframeSrc(src: string): boolean {
  if (!isSafeProtocolUrl(src)) return false;
  return getEmbedProvider(src) !== null;
}

const ALLOWED_STYLE_PROPERTIES = new Set(['color', 'background-color', 'text-align', 'vertical-align']);

const SAFE_HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const SAFE_RGB_COLOR_RE = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i;
const SAFE_HSL_COLOR_RE = /^hsla?\(\s*\d{1,3}(?:deg)?\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(?:,\s*(?:0|1|0?\.\d+)\s*)?\)$/i;
const SAFE_VAR_RE = /^var\(--[a-zA-Z0-9_-]+\)$/;
const SAFE_NAMED_COLORS = new Set([
  'inherit', 'transparent', 'currentcolor',
  'black', 'white', 'gray', 'grey', 'silver', 'maroon', 'red', 'purple',
  'fuchsia', 'green', 'lime', 'olive', 'yellow', 'navy', 'blue', 'teal',
  'aqua', 'orange', 'slate', 'amber', 'emerald', 'cyan', 'sky', 'indigo', 'violet', 'rose'
]);
const SAFE_TEXT_ALIGN = new Set(['left', 'center', 'right', 'justify']);
const SAFE_VERTICAL_ALIGN = new Set(['baseline', 'sub', 'super', 'top', 'middle', 'bottom']);

export function isSafeCssColor(value: string): boolean {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  // Disallow dangerous CSS expressions or URL loads
  if (/[<>"'\\;{}]/i.test(trimmed)) return false;
  if (/url\(|expression\(|javascript:|@import/i.test(trimmed)) return false;

  if (SAFE_HEX_COLOR_RE.test(trimmed)) return true;
  if (SAFE_RGB_COLOR_RE.test(trimmed)) return true;
  if (SAFE_HSL_COLOR_RE.test(trimmed)) return true;
  if (SAFE_VAR_RE.test(trimmed)) return true;
  if (SAFE_NAMED_COLORS.has(trimmed.toLowerCase())) return true;

  return false;
}

export function sanitizeInlineStyle(style: unknown): string {
  if (typeof style !== 'string' || !style.trim()) return '';

  const declarations = style.split(';');
  const safeDecls: string[] = [];

  for (const decl of declarations) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx === -1) continue;

    const prop = decl.slice(0, colonIdx).trim().toLowerCase();
    const val = decl.slice(colonIdx + 1).trim();

    if (!ALLOWED_STYLE_PROPERTIES.has(prop)) continue;

    // Disallow dangerous CSS expressions or URL loads in the property or value
    if (/[<>"'\\;{}]/i.test(val) || /url\(|expression\(|javascript:|@import/i.test(val)) {
      continue;
    }

    if (prop === 'color' || prop === 'background-color') {
      if (isSafeCssColor(val)) {
        safeDecls.push(`${prop}: ${val}`);
      }
    } else if (prop === 'text-align') {
      if (SAFE_TEXT_ALIGN.has(val.toLowerCase())) {
        safeDecls.push(`${prop}: ${val.toLowerCase()}`);
      }
    } else if (prop === 'vertical-align') {
      if (SAFE_VERTICAL_ALIGN.has(val.toLowerCase())) {
        safeDecls.push(`${prop}: ${val.toLowerCase()}`);
      }
    }
  }

  return safeDecls.join('; ');
}

const DISCARD_CONTAINER_TAGS = new Set([
  'script',
  'style',
  'textarea',
  'title',
  'noscript',
  'noembed',
  'noframes',
  'xmp',
  'template',
  'object',
  'embed',
  'applet',
  'frame',
  'frameset',
]);

type P5Node = {
  nodeName: string;
  tagName?: string;
  namespaceURI?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: P5Node[];
  value?: string;
  parentNode?: P5Node;
};

function isTextNode(node: P5Node): boolean {
  return node.nodeName === '#text';
}

function isCommentNode(node: P5Node): boolean {
  return node.nodeName === '#comment';
}

/**
 * Returns a list of replacement nodes (0 = dropped, N = flattened safe text
 * from dropped wrappers). Discard containers (script, style, math, svg, etc.)
 * are dropped entirely to prevent RAWTEXT escapes and namespace confusion.
 * Safe flattened text nodes always inherit the active container parent.
 */
function sanitizeNode(node: P5Node, parentNode?: P5Node): P5Node[] {
  if (isCommentNode(node)) {
    return [];
  }
  if (isTextNode(node)) {
    return [{
      nodeName: '#text',
      value: node.value || '',
      parentNode: parentNode,
    }];
  }

  const tag = (node.tagName || '').toLowerCase();
  if (DISCARD_CONTAINER_TAGS.has(tag)) {
    return [];
  }

  if (!STUDIO_ALLOWED_TAGS.has(tag)) {
    const out: P5Node[] = [];
    for (const child of node.childNodes || []) {
      out.push(...sanitizeNode(child, parentNode));
    }
    return out;
  }

  const attrs = (node.attrs || []).filter((attr) => {
    const name = attr.name.toLowerCase();
    if (name.startsWith('on')) return false; // event handlers
    if (name === 'style') {
      const sanitized = sanitizeInlineStyle(attr.value);
      if (!sanitized) return false;
      attr.value = sanitized;
      return true;
    }
    if (name.startsWith('data-') && !GLOBAL_ATTRS.has(name)) return false;
    if (name === 'srcdoc' || name === 'formaction' || name === 'xlink:href') return false;

    if (name === 'class') {
      // Only allow class names that look like layout/theme classes.
      return /^[a-zA-Z0-9_-]+(\s[a-zA-Z0-9_-]+)*$/.test(attr.value || '');
    }

    const allowed = GLOBAL_ATTRS.has(name) || (TAG_ATTRS[tag] || new Set()).has(name);
    if (!allowed) return false;

    if (name === 'title' || name === 'alt' || name === 'aria-label') {
      attr.value = (attr.value || '').replace(/[<>]/g, '');
    }

    if (URL_ATTRS.has(name)) {
      const value = attr.value || '';
      if (tag === 'iframe') {
        return isAllowedIframeSrc(value);
      }
      const context = name === 'href' ? 'link' : tag === 'img' || name === 'poster' ? 'image' : 'media';
      return isSafeStudioUrl(value, context, { allowDataImages: tag === 'img' });
    }
    return true;
  });

  if (tag === 'a') {
    const href = attrs.find((a) => a.name.toLowerCase() === 'href');
    if (!href || href.value.trim() === '') {
      // Strip an unsafe anchor but retain its readable, inert children.
      return (node.childNodes || []).flatMap((c) => sanitizeNode(c, parentNode));
    }

    // Validate target attribute
    const targetIdx = attrs.findIndex((a) => a.name.toLowerCase() === 'target');
    let isBlank = false;
    if (targetIdx !== -1) {
      const targetAttr = attrs[targetIdx];
      if (targetAttr) {
        const rawTarget = targetAttr.value.trim().toLowerCase();
        if (rawTarget === '_blank') {
          isBlank = true;
          targetAttr.value = '_blank';
        } else if (rawTarget === '_self' || rawTarget === '_parent' || rawTarget === '_top') {
          targetAttr.value = rawTarget;
        } else {
          attrs.splice(targetIdx, 1);
        }
      }
    }

    // Enforce safe rel protection
    const relIdx = attrs.findIndex((a) => a.name.toLowerCase() === 'rel');
    const relAttr = relIdx !== -1 ? attrs[relIdx] : undefined;
    if (isBlank) {
      const existingRel = relAttr ? relAttr.value : '';
      const tokens = new Set(
        existingRel
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => ALLOWED_REL_TOKENS.has(t))
      );
      tokens.add('noopener');
      tokens.add('noreferrer');
      tokens.delete('opener');
      const normalizedRel = Array.from(tokens).join(' ');
      if (relAttr) {
        relAttr.value = normalizedRel;
      } else {
        attrs.push({ name: 'rel', value: normalizedRel });
      }
    } else if (relAttr) {
      const tokens = new Set(
        relAttr.value
          .toLowerCase()
          .split(/\s+/)
          .filter((t) => ALLOWED_REL_TOKENS.has(t))
      );
      tokens.delete('opener');
      if (tokens.size > 0) {
        relAttr.value = Array.from(tokens).join(' ');
      } else if (relIdx !== -1) {
        attrs.splice(relIdx, 1);
      }
    }
  }

  if (tag === 'input') {
    const typeAttr = attrs.find((a) => a.name.toLowerCase() === 'type');
    if (!typeAttr || typeAttr.value.toLowerCase() !== 'checkbox') {
      return [];
    }
  }

  if (tag === 'iframe' && !attrs.some((a) => a.name.toLowerCase() === 'src')) {
    // An iframe without a validated provider src is dropped entirely.
    return [];
  }

  const isLeafTag = tag === 'img' || tag === 'hr' || tag === 'input' || tag === 'source' || tag === 'iframe';
  if (isLeafTag) {
    return [{
      nodeName: tag,
      tagName: tag,
      namespaceURI: 'http://www.w3.org/1999/xhtml',
      attrs,
      childNodes: [],
      parentNode: parentNode,
    }];
  }

  const safeElement: P5Node = {
    nodeName: tag,
    tagName: tag,
    namespaceURI: 'http://www.w3.org/1999/xhtml',
    attrs,
    childNodes: [],
    parentNode: parentNode,
  };

  const childNodes: P5Node[] = [];
  for (const child of node.childNodes || []) {
    childNodes.push(...sanitizeNode(child, safeElement));
  }
  safeElement.childNodes = childNodes;

  return [safeElement];
}

/** Sanitize arbitrary HTML to the Studio allowlist. Safe content survives; every script/event/unsafe-URL vector is removed. */
export function sanitizeStudioHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  try {
    const fragment = parseFragment(html) as unknown as P5Node;
    const cleanFragment: P5Node = {
      nodeName: '#document-fragment',
      childNodes: [],
    };
    for (const child of fragment.childNodes || []) {
      cleanFragment.childNodes?.push(...sanitizeNode(child, cleanFragment));
    }
    const out = serialize(cleanFragment as never);
    return out;
  } catch {
    return '';
  }
}

/** Extract plain text from HTML (used for excerpts/plain-text rendering). */
export function stripHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';
  try {
    const fragment = parseFragment(html) as unknown as P5Node;
    const parts: string[] = [];
    function walk(node: P5Node) {
      if (isTextNode(node)) {
        if (node.value) parts.push(node.value);
        return;
      }
      for (const child of node.childNodes || []) walk(child);
    }
    for (const child of fragment.childNodes || []) walk(child);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}
