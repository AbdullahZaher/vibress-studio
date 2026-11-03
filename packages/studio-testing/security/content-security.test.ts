import { describe, expect, it } from 'vitest';
import { htmlToStudioDocument } from '@vibress/studio-html';
import { renderStudioDocumentToHtml } from '@vibress/studio-renderer';
import { isSafeUrl, sanitizeStudioHtml } from '@vibress/studio-utils';

describe('Studio security regression boundaries', () => {
  it('removes script elements and inline event handlers from published HTML', () => {
    const input = '<script>alert(1)</script><img src="/asset.png" onerror="alert(2)"><p onclick="alert(3)">Safe</p>';
    const sanitized = sanitizeStudioHtml(input);
    expect(sanitized).not.toMatch(/<script|onerror\s*=|onclick\s*=/i);
    expect(sanitized).toContain('Safe');
  });

  it('rejects executable URL schemes', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeUrl('https://example.com/arabic')).toBe(true);
  });

  it('sanitizes untrusted HTML before round-trip rendering', () => {
    const doc = htmlToStudioDocument('<p onclick="evil()">العربية <em>safe</em></p><a href="javascript:alert(1)">unsafe</a>');
    const output = renderStudioDocumentToHtml(doc);
    expect(output).not.toMatch(/onclick\s*=|javascript:|<script/i);
    expect(output).toContain('العربية');
    expect(output).toContain('<em>safe</em>');
  });
});
