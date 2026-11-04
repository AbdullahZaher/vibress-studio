export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeBasicEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&colon;?/gi, ':')
    .replace(/&tab;?/gi, '')
    .replace(/&newline;?/gi, '');
}

export function isSafeUrl(url: unknown): boolean {
  if (typeof url !== 'string') return false;
  const decoded = decodeBasicEntities(url.trim());
  const stripped = decoded.replace(/[\u0000-\u001f\u007f-\u009f\s]+/g, '').toLowerCase();

  // Reject dangerous protocols
  if (
    stripped.startsWith('javascript:') ||
    stripped.startsWith('vbscript:') ||
    stripped.startsWith('file:') ||
    stripped.startsWith('blob:')
  ) {
    return false;
  }

  // Reject data: URIs except safe raster image data URIs
  if (stripped.startsWith('data:')) {
    return /^data:image\/(png|jpe?g|gif|webp|avif);base64,/i.test(url.trim());
  }

  // Allow safe protocols or relative paths
  if (
    stripped.startsWith('http://') ||
    stripped.startsWith('https://') ||
    stripped.startsWith('mailto:') ||
    stripped.startsWith('tel:') ||
    url.trim().startsWith('/') ||
    url.trim().startsWith('#')
  ) {
    return true;
  }

  // If no scheme present (e.g. "example.com"), treat as relative/safe unless it contains colon early
  const firstColon = stripped.indexOf(':');
  if (firstColon === -1) return true;

  return false;
}

export function sanitizeUrl(url: string, fallback = '#'): string {
  if (!url || !isSafeUrl(url)) {
    return fallback;
  }
  return url.trim();
}

/**
 * Sanitize arbitrary HTML against the Studio allowlist.
 *
 * Implemented with a real HTML parser (parse5) — NOT a regex filter.
 * Safe semantic markup survives; script/event-handler/unsafe-URL vectors are
 * removed. See sanitize.ts for the full allowlist and URL rules.
 */
export function sanitizeHtml(html: string): string {
  return sanitizeStudioHtml(html);
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

import { sanitizeStudioHtml } from './sanitize';

export * from './markdown';
export * from './sanitize';
