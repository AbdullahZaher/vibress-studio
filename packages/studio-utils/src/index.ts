export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Characters that can never appear in a URL interpolated into an HTML
 * attribute. Rejecting them prevents attribute breakout (e.g.
 * `https://example.com" onerror="alert(1)`).
 */
const URL_ATTRIBUTE_BREAKOUT_CHARS = /["'<>`\r\n\t\u0000-\u001f]/;

/**
 * HTML entity forms of the breakout characters (decoded by browsers during
 * attribute tokenization). Rejecting them keeps URLs safe even where a
 * downstream interpolation forgets to re-escape.
 */
const URL_DANGEROUS_ENTITIES = /&(?:quot|#34|#x?22|apos|#39|#x?27|lt|#60|#x?3c|gt|#62|#x?3e);?/i;

/**
 * Raster image data: URLs allowed as image sources (SVG is excluded because
 * SVG can embed scripts and requires a dedicated sanitizer).
 */
const ALLOWED_DATA_IMAGE_PREFIXES = [
  'data:image/png',
  'data:image/jpeg',
  'data:image/gif',
  'data:image/webp',
];

export function isSafeUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return false;

  // Reject dangerous protocols (check before generic http allow so that
  // mixed-case / obfuscated prefixes cannot slip through)
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.startsWith('file:')
  ) {
    return false;
  }

  // Never allow characters that can break out of an HTML attribute.
  if (URL_ATTRIBUTE_BREAKOUT_CHARS.test(url)) {
    return false;
  }

  // Never allow entity-encoded breakout characters (e.g. `&quot;`).
  if (URL_DANGEROUS_ENTITIES.test(url)) {
    return false;
  }

  // Allow safe protocols or relative paths
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('#')
  ) {
    return true;
  }

  // Allow only explicit raster data:image prefixes (never svg+xml)
  if (trimmed.startsWith('data:image/')) {
    return ALLOWED_DATA_IMAGE_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
  }

  // If no scheme present (e.g. "example.com"), treat as relative/safe unless it contains colon early
  const firstColon = trimmed.indexOf(':');
  if (firstColon === -1) return true;

  return false;
}

export function sanitizeUrl(url: string, fallback = '#'): string {
  if (!url || !isSafeUrl(url)) {
    return fallback;
  }
  return url.trim();
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';

  // Remove script tags and their contents
  let clean = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove inline event handlers like onclick, onerror
  clean = clean.replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Neutralize javascript: URLs in href/src
  clean = clean.replace(/(href|src)\s*=\s*["']?\s*javascript:[^"'>\s]*/gi, '$1="#"');

  return clean;
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export * from './markdown';
