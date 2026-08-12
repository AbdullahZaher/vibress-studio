/**
 * URL sanitization for interpolating user-provided URLs into HTML attributes.
 *
 * Security model:
 *  1. Protocol allowlist (http/https/mailto/tel, relative, raster data:image,
 *     blob: for previews). javascript:/vbscript:/file:/data:text/html and
 *     data:image/svg+xml are rejected.
 *  2. Attribute-breakout characters and entity forms are rejected so the URL
 *     can never close the surrounding attribute.
 */

/** Characters that can never appear in a URL interpolated into an attribute. */
const URL_ATTRIBUTE_BREAKOUT_CHARS = /[\"'<>`\r\n\t\u0000-\u001f]/;

/** Entity-encoded breakout characters (decoded by browsers during tokenization). */
const URL_DANGEROUS_ENTITIES =
  /&(?:quot|#34|#x?22|apos|#39|#x?27|lt|#60|#x?3c|gt|#62|#x?3e);?/i;

/** Raster image data: URLs allowed as image sources (SVG excluded). */
export const ALLOWED_DATA_IMAGE_PREFIXES = [
  'data:image/png',
  'data:image/jpeg',
  'data:image/gif',
  'data:image/webp',
];

export function isSafeUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return false;

  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.startsWith('file:')
  ) {
    return false;
  }

  if (URL_ATTRIBUTE_BREAKOUT_CHARS.test(url)) {
    return false;
  }

  if (URL_DANGEROUS_ENTITIES.test(url)) {
    return false;
  }

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

  if (trimmed.startsWith('data:image/')) {
    return ALLOWED_DATA_IMAGE_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
  }

  const firstColon = trimmed.indexOf(':');
  if (firstColon === -1) return true;

  return false;
}

/**
 * Sanitize a URL for attribute interpolation. Returns `fallback` (default
 * `#`) when the URL is unsafe. The returned value must still be passed
 * through `escapeAttribute` before interpolation.
 */
export function sanitizeUrl(url: string, fallback = '#'): string {
  if (!url || !isSafeUrl(url)) {
    return fallback;
  }
  return url.trim();
}
