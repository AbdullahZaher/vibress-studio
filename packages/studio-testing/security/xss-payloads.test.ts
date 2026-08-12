import { describe, it, expect } from 'vitest';
import { escapeHtml, sanitizeUrl, isSafeUrl } from '@vibress/studio-utils';
import { renderStudioDocumentToHtml, renderStudioDocumentToPlainText } from '@vibress/studio-renderer';

/**
 * Canonical XSS regression payload set (see docs/security/xss-regression-matrix.md).
 * Every payload must be BLOCKED or ESCAPED by every renderer path.
 *
 * Layer coverage:
 *  - escape: payloads placed in text nodes must be escaped by the renderer.
 *  - url:    payloads used as URLs must be rejected by sanitizeUrl/isSafeUrl.
 *  - sanitize/parser/policy layers are covered by P1/P2/P3/P6 suites
 *    (sanitize.test.ts, renderer-cards.test.ts, safe-html.test.ts, html-import.test.ts).
 */
export const XSS_PAYLOADS: string[] = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<a href="javascript:alert(1)">x</a>',
  '<img src="https://example.com&quot; onerror=&quot;alert(1)">',
  '<div style="background:url(javascript:alert(1))">',
  '<math href="javascript:alert(1)">',
  '<form action="https://evil.example">',
  '<object data="https://evil.example/x.swf"></object>',
];

describe('XSS payloads — escaping layer (text nodes)', () => {
  it.each(XSS_PAYLOADS)('escapeHtml escapes payload: %s', (payload) => {
    const escaped = escapeHtml(payload);
    // No raw angle brackets may survive (raw markup is impossible after escaping).
    expect(escaped).not.toMatch(/</);
    expect(escaped).not.toMatch(/>/);
    // Dangerous tokens must not appear inside a live tag; as escaped text they
    // may still contain the letters but never bracket-wrapped markup.
    expect(escaped).toContain('&lt;');
    expect(escaped).not.toMatch(/<(script|img|svg|iframe|a|div|math|form|object)\b/i);
  });

  it.each(XSS_PAYLOADS)('renderer escapes payload placed in a text node: %s', (payload) => {
    const doc = {
      schema: 'vibress-studio',
      version: 1,
      editor: { lexicalVersion: '0.13.1' },
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: payload, format: 0, mode: 'normal', version: 1 }],
            version: 1,
          },
        ],
        version: 1,
      },
    };
    const html = renderStudioDocumentToHtml(doc);
    // The payload must only ever appear in escaped form (its text is escaped),
    // never as a live element.
    expect(html).toContain(escapeHtml(payload));
    expect(html).not.toMatch(/<(script|svg|math|form|object|iframe)\b/i);
    expect(html).not.toMatch(/<img\b/i);
  });
});

describe('XSS payloads — URL layer', () => {
  it('blocks javascript: URLs', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(sanitizeUrl('javascript:alert(1)', '#')).toBe('#');
    // Mixed-case and whitespace obfuscation
    expect(sanitizeUrl('  JaVaScRiPt:alert(1)  ', '#')).toBe('#');
    expect(sanitizeUrl('javascript:alert(1)\t', '#')).toBe('#');
  });

  it('blocks vbscript: and file: URLs', () => {
    expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
  });

  it('blocks data:text/html and svg data urls in generic positions', () => {
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeUrl('data:image/svg+xml,<svg onload=alert(1)>')).toBe(false);
    expect(sanitizeUrl('data:image/svg+xml,<svg onload=alert(1)>', '#')).toBe('#');
  });

  it('allows safe http/https/mailto/tel and relative URLs', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(isSafeUrl('http://example.com')).toBe(true);
    expect(isSafeUrl('mailto:test@example.com')).toBe(true);
    expect(isSafeUrl('tel:+10000000000')).toBe(true);
    expect(isSafeUrl('/relative/path')).toBe(true);
    expect(isSafeUrl('#fragment')).toBe(true);
  });

  it('allows raster data:image urls for image sources only when policy permits', () => {
    expect(isSafeUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
    expect(isSafeUrl('data:image/jpeg;base64,/9j/4AAQ=')).toBe(true);
    expect(isSafeUrl('data:image/webp;base64,UklGR')).toBe(true);
  });

  it('rejects attribute-breakout URLs', () => {
    // Payload #6 variants: quote breakout must be rejected outright.
    expect(isSafeUrl('https://example.com&quot; onerror=&quot;alert(1)')).toBe(false);
    expect(isSafeUrl('https://example.com" onerror="alert(1)')).toBe(false);
    expect(sanitizeUrl('https://example.com" onerror="alert(1)', '#')).toBe('#');
    expect(isSafeUrl('https://example.com\' onmouseover=\'alert(1)')).toBe(false);
    expect(isSafeUrl('https://example.com<br>')).toBe(false);
    // Control characters are never allowed.
    expect(isSafeUrl('https://example.com/\njavascript:alert(1)')).toBe(false);
  });
});

describe('XSS payloads — plain text rendering', () => {
  it.each(XSS_PAYLOADS)('plain text renderer is markup-free (payload only as text): %s', (payload) => {
    const doc = {
      schema: 'vibress-studio',
      version: 1,
      editor: { lexicalVersion: '0.13.1' },
      root: {
        type: 'root',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: payload, format: 0, mode: 'normal', version: 1 }],
            version: 1,
          },
        ],
        version: 1,
      },
    };
    // Plain text output is safe-by-construction: it is never interpreted as
    // HTML. Embedding it in HTML requires escaping (covered above).
    const text = renderStudioDocumentToPlainText(doc);
    expect(text).toContain(payload);
    // When such text is escaped for HTML embedding, no raw markup survives.
    expect(escapeHtml(text)).not.toMatch(/</);
  });
});
