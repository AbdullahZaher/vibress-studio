import { describe, expect, it } from 'vitest';
import { sanitizeStudioHtml, sanitizeInlineStyle } from '@vibress/studio-utils';

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
});
