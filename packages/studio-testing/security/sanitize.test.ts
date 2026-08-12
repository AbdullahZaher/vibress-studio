import { describe, it, expect } from 'vitest';
import { sanitizeHtmlFragment, sanitizeHtml, escapeHtml, escapeAttribute, sanitizeUrl, HTML_SANITIZE_POLICY } from '@vibress/studio-utils';
import { XSS_PAYLOADS } from './xss-payloads.test';

/**
 * P1: allowlist sanitizer tests. Every row of the XSS regression matrix must
 * be neutralized by `sanitizeHtmlFragment` (the regex sanitizer is gone).
 */
describe('HTML sanitizer — allowlist policy (P1)', () => {
  it('policy is explicit and excludes scriptable tags', () => {
    expect(HTML_SANITIZE_POLICY.allowedTags).not.toContain('script');
    expect(HTML_SANITIZE_POLICY.allowedTags).not.toContain('iframe');
    expect(HTML_SANITIZE_POLICY.allowedTags).not.toContain('svg');
    expect(HTML_SANITIZE_POLICY.allowedTags).not.toContain('math');
    expect(HTML_SANITIZE_POLICY.allowedTags).not.toContain('object');
    expect(HTML_SANITIZE_POLICY.allowedTags).not.toContain('embed');
    expect(HTML_SANITIZE_POLICY.allowedTags).not.toContain('form');
    expect(HTML_SANITIZE_POLICY.allowedTags).not.toContain('style');
  });

  it('event handler attributes and style attributes are stripped from allowed tags', () => {
    const out = sanitizeHtmlFragment('<p onclick="alert(1)" style="color:red" onmouseover="x()">hi</p>');
    expect(out).toBe('<p>hi</p>');
  });

  it('allows basic formatting tags', () => {
    const out = sanitizeHtmlFragment('<p><strong>b</strong> <em>i</em> <a href="https://x.com" target="_blank" rel="noopener">l</a></p>');
    expect(out).toContain('<strong>b</strong>');
    expect(out).toContain('<em>i</em>');
    expect(out).toContain('<a href="https://x.com"');
  });

  it('strips javascript: and dangerous protocols from href/src', () => {
    expect(sanitizeHtmlFragment('<a href="javascript:alert(1)">x</a>')).not.toContain('javascript:');
    expect(sanitizeHtmlFragment('<img src="javascript:alert(1)">')).not.toContain('javascript:');
    expect(sanitizeHtmlFragment('<a href="vbscript:msgbox">x</a>')).not.toContain('vbscript:');
    // data:text/html is rejected
    expect(sanitizeHtmlFragment('<img src="data:text/html,<script>alert(1)</script>">')).not.toContain('<script>');
  });

  it('rejects data:image/svg+xml src', () => {
    const out = sanitizeHtmlFragment('<img src="data:image/svg+xml,<svg onload=alert(1)>">');
    expect(out).not.toContain('svg');
  });

  it('keeps raster data:image src', () => {
    const out = sanitizeHtmlFragment('<img src="data:image/png;base64,iVBORw0KGgo=">');
    expect(out).toContain('data:image/png');
  });

  it('all 10 matrix payloads are neutralized', () => {
    for (const payload of XSS_PAYLOADS) {
      const out = sanitizeHtmlFragment(payload);
      expect(out, `payload not neutralized: ${payload}`).not.toMatch(/<(script|iframe|object|embed|form|input|svg|math)\b/i);
      expect(out, `payload not neutralized: ${payload}`).not.toMatch(/\son\w+\s*=/i);
      expect(out, `payload not neutralized: ${payload}`).not.toContain('javascript:');
      expect(out, `payload not neutralized: ${payload}`).not.toContain('srcdoc');
      expect(out, `payload not neutralized: ${payload}`).not.toContain('style=');
    }
  });

  it('does not emit raw script content (content discarded with tag)', () => {
    const out = sanitizeHtmlFragment('<script>alert(1)</script><p>ok</p>');
    expect(out).toBe('<p>ok</p>');
    expect(out).not.toContain('alert(1)');
  });

  it('handles malformed/entity-obfuscated payloads', () => {
    // Entity-encoded event handler
    expect(sanitizeHtmlFragment('<img src=x onerror=alert(1)>')).not.toContain('onerror');
    // Angle-bracket obfuscation with entities is still escaped/removed
    const out = sanitizeHtmlFragment('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(out).not.toMatch(/<script/i);
    // Nested/upper-case tags
    expect(sanitizeHtmlFragment('<SCRIPT>alert(1)</SCRIPT>')).not.toContain('SCRIPT');
    expect(sanitizeHtmlFragment('<ScRiPt>alert(1)</sCrIpT>')).not.toContain('alert');
  });
});

describe('HTML sanitizer — escaping helpers (P1)', () => {
  it('escapeAttribute escapes quotes, angle brackets, and backticks', () => {
    const out = escapeAttribute('"><script>alert(1)</script><img src=x onerror=alert(1)>`');
    expect(out).not.toMatch(/["'<>`]/);
  });

  it('sanitizeUrl enforces protocols before interpolation', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('#');
    expect(sanitizeUrl('https://ok.example/path?a=1')).toBe('https://ok.example/path?a=1');
  });

  it('backwards-compatible sanitizeHtml alias behaves like the allowlist sanitizer', () => {
    expect(sanitizeHtml('<script>alert(1)</script>')).not.toContain('script');
    expect(sanitizeHtml('<p>ok</p>')).toBe('<p>ok</p>');
  });

  it('escapeHtml is safe for text nodes', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
  });
});
