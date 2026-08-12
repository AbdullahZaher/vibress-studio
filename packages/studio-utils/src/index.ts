import { sanitizeHtmlFragment } from './sanitize/sanitize-html.js';

export { escapeHtml } from './sanitize/escape-html.js';
export { escapeAttribute } from './sanitize/escape-attribute.js';
export { isSafeUrl, sanitizeUrl, ALLOWED_DATA_IMAGE_PREFIXES } from './sanitize/sanitize-url.js';
export { sanitizeHtmlFragment, HTML_SANITIZE_POLICY } from './sanitize/sanitize-html.js';
export {
  HTML_ALLOWED_TAGS,
  HTML_ALLOWED_ATTRIBUTES,
  HTML_ALLOWED_SCHEMES,
  HARD_DENY_TAGS,
  HARD_DENY_ATTRIBUTES,
  type StudioSanitizePolicy,
} from './sanitize/policy.js';

/**
 * Backwards-compatible alias for the allowlist sanitizer. The regex-only
 * sanitizer was removed in the P1 hardening phase.
 */
export const sanitizeHtml = sanitizeHtmlFragment;

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

/**
 * Escape a string for safe use inside a RegExp constructor. Prevents
 * user-supplied query strings from breaking the pattern or injecting
 * regex operators (e.g. `[`, `(`, `*`).
 */
export function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export * from './markdown.js';
