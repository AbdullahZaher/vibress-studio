/**
 * Allowlist HTML sanitizer backed by `sanitize-html`.
 *
 * IMPORTANT: this is the ONLY production HTML sanitizer. Regex-based
 * sanitization was removed in the P1 hardening phase because it can be
 * bypassed (attribute breakout, entity encoding, malformed markup).
 *
 * Layering:
 *  1. `allowedTags`/`allowedAttributes` allowlist (event handlers, style,
 *     srcdoc, and other non-allowlisted attributes are stripped by the
 *     library itself — attributes never carry children away).
 *  2. `exclusiveFilter` removes hard-deny tags WITH their entire subtree
 *     (script, iframe, object, embed, form, svg, math, ...).
 *  3. `transformTags` re-validates `src`/`href` against the Studio URL
 *     policy (`isSafeUrl`), which rejects javascript:/vbscript:/file:,
 *     attribute-breakout characters, entity-encoded breakouts, and
 *     `data:image/svg+xml`.
 */

import sanitizeHtmlLib from 'sanitize-html';
import { HTML_SANITIZE_POLICY, HARD_DENY_TAGS } from './policy';
import { isSafeUrl } from './sanitize-url';

export type { StudioSanitizePolicy } from './policy';
export { HTML_SANITIZE_POLICY, HTML_ALLOWED_TAGS, HTML_ALLOWED_ATTRIBUTES } from './policy';

const DEFAULT_OPTIONS: sanitizeHtmlLib.IOptions = {
  allowedTags: HTML_SANITIZE_POLICY.allowedTags,
  allowedAttributes: HTML_SANITIZE_POLICY.allowedAttributes,
  allowedSchemes: HTML_SANITIZE_POLICY.allowedSchemes,
  allowedSchemesByTag: HTML_SANITIZE_POLICY.allowedSchemesByTag,
  disallowedTagsMode: HTML_SANITIZE_POLICY.disallowedTagsMode,
  allowProtocolRelative: false,
  exclusiveFilter: (frame) => {
    // Hard-deny tags are removed together with their subtree. This is the
    // only place whole-subtree removal is correct (script content etc.).
    return (HARD_DENY_TAGS as readonly string[]).includes(frame.tag.toLowerCase());
  },
  transformTags: {
    img: (tagName, attribs) => {
      if (attribs.src && !isSafeUrl(attribs.src)) {
        delete attribs.src;
      }
      return { tagName, attribs };
    },
    a: (tagName, attribs) => {
      if (attribs.href && !isSafeUrl(attribs.href)) {
        delete attribs.href;
      }
      return { tagName, attribs };
    },
  },
};

/**
 * Sanitize an HTML fragment (e.g. captionHtml, embed html, markdown output)
 * against the Studio allowlist policy.
 */
export function sanitizeHtmlFragment(html: string): string {
  if (!html || typeof html !== 'string') return '';
  return sanitizeHtmlLib(html, DEFAULT_OPTIONS).trim();
}
