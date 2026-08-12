import { sanitizeHtmlFragment } from './sanitize/sanitize-html';

export { escapeHtml } from './sanitize/escape-html';
export { escapeAttribute } from './sanitize/escape-attribute';
export { isSafeUrl, sanitizeUrl, ALLOWED_DATA_IMAGE_PREFIXES } from './sanitize/sanitize-url';
export { sanitizeHtmlFragment, HTML_SANITIZE_POLICY } from './sanitize/sanitize-html';
export {
  HTML_ALLOWED_TAGS,
  HTML_ALLOWED_ATTRIBUTES,
  HTML_ALLOWED_SCHEMES,
  HARD_DENY_TAGS,
  HARD_DENY_ATTRIBUTES,
  type StudioSanitizePolicy,
} from './sanitize/policy';

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

export * from './markdown';
