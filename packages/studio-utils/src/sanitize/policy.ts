/**
 * Allowlist HTML sanitization policy for Vibress Studio.
 *
 * This is the single source of truth for what HTML fragments may contain.
 * It is intentionally strict: no style attributes, no event handlers, no
 * scriptable tags, and only safe URL protocols.
 *
 * See docs/sanitization-policy.md for the full rationale.
 */

export interface StudioSanitizePolicy {
  allowedTags: string[];
  allowedAttributes: Record<string, string[]>;
  allowedSchemes: string[];
  allowedSchemesByTag: Record<string, string[]>;
  disallowedTagsMode: 'discard';
  allowProtocolRelative: boolean;
}

export const HTML_ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  's',
  'u',
  'code',
  'pre',
  'blockquote',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'a',
  'img',
  'figure',
  'figcaption',
  'hr',
  'span',
] as const;

export const HTML_ALLOWED_ATTRIBUTES: Record<string, string[]> = {
  a: ['href', 'title', 'target', 'rel'],
  img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
  span: ['class'],
  code: ['class'],
  pre: ['class'],
  figure: ['class'],
  figcaption: ['class'],
  // Global: everything else gets stripped.
};

export const HTML_ALLOWED_SCHEMES = ['http', 'https', 'mailto', 'tel'] as const;

/**
 * Image src may additionally accept raster data: URLs and blob: URLs
 * (local previews). SVG data URLs are never allowed.
 */
export const HTML_ALLOWED_SCHEMES_BY_TAG: Record<string, string[]> = {
  img: ['http', 'https', 'data', 'blob'],
};

export const HTML_SANITIZE_POLICY: StudioSanitizePolicy = {
  allowedTags: [...HTML_ALLOWED_TAGS],
  allowedAttributes: Object.fromEntries(
    Object.entries(HTML_ALLOWED_ATTRIBUTES).map(([tag, attrs]) => [tag, [...attrs]])
  ),
  allowedSchemes: [...HTML_ALLOWED_SCHEMES],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data', 'blob'],
  },
  disallowedTagsMode: 'discard',
  allowProtocolRelative: false,
};

/**
 * Tags that are ALWAYS stripped regardless of policy evolution. Kept in sync
 * with docs/security/threat-model.md section 5.
 */
export const HARD_DENY_TAGS = [
  'script',
  'style',
  'iframe',
  'object',
  'embed',
  'form',
  'input',
  'button',
  'svg',
  'math',
  'link',
  'meta',
  'base',
  'template',
  'frameset',
  'frame',
  'noscript',
] as const;

export const HARD_DENY_ATTRIBUTES = [
  'srcdoc',
  'style',
  'on*', // any event handler
  'background',
  'formaction',
  'xlink:href',
] as const;
