import { describe, expect, it } from 'vitest';
import { sanitizeStudioHtml, sanitizeInlineStyle, isSafeUrl } from '@vibress/studio-utils';
import { CalloutCardDefinition } from '@vibress/studio-cards';

describe('HTML policy boundaries (STU-402)', () => {
  it('removes active foreign markup and comments while keeping readable content', () => {
    const result = sanitizeStudioHtml('<!--private--><svg><a xlink:href="javascript:alert(1)">SVG text</a></svg><math><mi>Math text</mi></math><p>Keep</p>');
    expect(result).toContain('SVG text');
    expect(result).toContain('Math text');
    expect(result).toContain('<p>Keep</p>');
    expect(result).not.toMatch(/private|<svg|<math|xlink|javascript:/);
  });

  it('permits checkbox display but removes interactive input types and invalid classes', () => {
    const result = sanitizeStudioHtml('<input type="text" value="secret"><input type="checkbox" checked disabled><span class="valid-name">Keep</span><span class="bad/class">Text</span>');
    expect(result).not.toContain('type="text"');
    expect(result).toContain('type="checkbox" checked="" disabled=""');
    expect(result).toContain('class="valid-name"');
    expect(result).not.toContain('bad/class');
  });

  it('normalizes safe targets and rel values independently of new-window protection', () => {
    expect(sanitizeStudioHtml('<a href="/safe" target="_SELF" rel="tag TAG invalid">Read</a>')).toContain('target="_self" rel="tag"');
    expect(sanitizeStudioHtml('<a href="/safe" rel="invalid">Read</a>')).toBe('<a href="/safe">Read</a>');
  });

  it('keeps allowlisted alignment while rejecting unsupported declarations and colors', () => {
    expect(sanitizeInlineStyle('vertical-align: top; text-align: JUSTIFY; color: not-a-color; malformed;')).toBe('vertical-align: top; text-align: justify');
    expect(sanitizeInlineStyle('vertical-align: fixed; text-align: sideways; color: "red"')).toBe('');
  });

  it('completely discards RAWTEXT containers without unwrapping malicious child nodes', () => {
    expect(sanitizeStudioHtml('<script><img src=x onerror=alert(1)></script>')).toBe('');
    expect(sanitizeStudioHtml('<style><img src=x onerror=alert(2)></style>')).toBe('');
    expect(sanitizeStudioHtml('<textarea><script>alert(3)</script></textarea>')).toBe('');
    expect(sanitizeStudioHtml('<title><img src=x onerror=alert(4)></title>')).toBe('');
  });

  it('neutralizes MathML/RAWTEXT mutation-XSS vectors and prevents executable tags', () => {
    // Vectors attempting to smuggle executable handlers through namespace transitions or RAWTEXT
    expect(sanitizeStudioHtml('<math><style><img src=x onerror=alert(1)></style></math>')).toBe('<img src="x">');
    expect(sanitizeStudioHtml('<math><style><img src=x onerror=alert(1)></style></math>')).not.toMatch(/onerror|alert/i);
    expect(sanitizeStudioHtml('<svg><style><script>alert(1)</script></style></svg>')).toBe('');
    expect(sanitizeStudioHtml('<math><mtext><style><!--</style><script>alert(1)</script></mtext></math>')).toBe('');

    // When reparsed into DOM, mXSS vectors must not yield any event handlers or scripts
    const mxss = sanitizeStudioHtml('<math><mtext><table><mglyph><style><!--</style><img src=x onerror=alert(1)>');
    expect(mxss).not.toMatch(/onerror|alert/i);
  });

  it('sanitizes callout card background color against HTML attribute injection', () => {
    const html = CalloutCardDefinition.renderHtml({
      text: 'Callout content',
      emoji: '💡',
      backgroundColor: 'grey" onmouseover="alert(1)'
    });
    expect(html).not.toMatch(/onmouseover|alert|" onmouseover=/i);
    expect(html).toContain('bg-grey');
  });

  it('blocks dangerous protocol entities and data URIs in URLs', () => {
    expect(isSafeUrl('java\u0000script:alert(1)')).toBe(false);
    expect(isSafeUrl('data:image/svg+xml;utf8,<svg onload=alert(1)>')).toBe(false);
    expect(isSafeUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true);
  });
});
