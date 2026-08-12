/**
 * Studio HTML sanitization layer (consumer-facing).
 *
 * The canonical implementation lives in `@vibress/studio-utils/sanitize`
 * because both `studio-cards` (render-time sanitization of captions/markdown)
 * and `studio-html` (import-time sanitization) depend on it; placing the
 * implementation in `studio-html` would create a dependency cycle.
 *
 * This module is the documented entry point for host applications that want
 * to sanitize HTML before rendering.
 */
export {
  sanitizeHtmlFragment,
  sanitizeHtml,
  escapeHtml,
  escapeAttribute,
  sanitizeUrl,
  isSafeUrl,
  HTML_SANITIZE_POLICY,
  HTML_ALLOWED_TAGS,
  HTML_ALLOWED_ATTRIBUTES,
  HTML_ALLOWED_SCHEMES,
  HARD_DENY_TAGS,
  HARD_DENY_ATTRIBUTES,
} from '@vibress/studio-utils';
export type { StudioSanitizePolicy } from '@vibress/studio-utils';
