/**
 * Escape a value for safe interpolation into a double-quoted HTML attribute.
 *
 * In addition to the characters escaped by `escapeHtml`, backticks are
 * escaped (backtick can terminate a quoted attribute value in some
 * HTML/JS contexts and is commonly used in template-literal payloads).
 */

export function escapeAttribute(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}
