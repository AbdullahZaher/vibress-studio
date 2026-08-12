import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { SafeHtml, sanitizeToSafeHtml, type SanitizedHtml } from '@vibress/studio-react';
import { XSS_PAYLOADS } from './xss-payloads.test';

/**
 * P3: the React preview/editor boundary. `SafeHtml` accepts only branded
 * `SanitizedHtml` created by `sanitizeToSafeHtml`; raw script must never
 * render or execute.
 */

describe('SafeHtml boundary (P3)', () => {
  it('renders sanitized HTML', () => {
    const safe = sanitizeToSafeHtml('<p><strong>Hello</strong></p>');
    const { container } = render(<SafeHtml html={safe} />);
    expect(container.querySelector('strong')?.textContent).toBe('Hello');
  });

  it('sanitizeToSafeHtml strips script content entirely', () => {
    const safe = sanitizeToSafeHtml('<script>window.__xss = 1</script><p>ok</p>');
    const { container } = render(<SafeHtml html={safe} />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('p')?.textContent).toBe('ok');
  });

  it.each(XSS_PAYLOADS)('no live dangerous element/attribute renders for payload: %s', (payload) => {
    const safe = sanitizeToSafeHtml(payload);
    const { container } = render(<SafeHtml html={safe} />);
    expect(container.querySelector('script, iframe, object, embed, svg, math, form, input, button')).toBeNull();
    for (const el of Array.from(container.querySelectorAll('*'))) {
      for (const attr of Array.from(el.attributes)) {
        expect(attr.name.toLowerCase()).not.toMatch(/^on[a-z]+$/);
        expect(attr.name.toLowerCase()).not.toBe('srcdoc');
        expect(attr.name.toLowerCase()).not.toBe('style');
      }
    }
  });

  it('escapes dangerous attribute values instead of mounting them', () => {
    const safe = sanitizeToSafeHtml('<img src=x onerror="alert(1)">');
    const { container } = render(<SafeHtml html={safe} />);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('onerror')).toBeNull();
  });

  it('SanitizedHtml is a branded wrapper produced only by sanitizeToSafeHtml', () => {
    const safe = sanitizeToSafeHtml('<p>x</p>');
    expect(safe.__brand).toBe('SanitizedHtml');
    expect(typeof safe.html).toBe('string');
    // Compile-time: a raw string is NOT assignable to SanitizedHtml.
    // @ts-expect-error — raw string is not SanitizedHtml
    const invalid: SanitizedHtml = '<script>alert(1)</script>';
    void invalid;
  });

  it('html card preview output is sanitized through the boundary', () => {
    // The HTML card renderer output is already sanitized (P2); the boundary
    // re-sanitizes it, so raw input can never reach dangerouslySetInnerHTML.
    const raw = '<script>alert(1)</script><div onclick="x()">body</div>';
    const safe = sanitizeToSafeHtml(raw);
    expect(safe.html).not.toContain('<script>');
    expect(safe.html).not.toContain('onclick');
    expect(safe.html).toContain('body');
  });

  it('embed preview does not mount iframes for arbitrary html', () => {
    const safe = sanitizeToSafeHtml(
      '<iframe src="https://evil.example" srcdoc="<script>alert(1)</script>"></iframe>'
    );
    const { container } = render(<SafeHtml html={safe} />);
    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('script')).toBeNull();
  });
});
