import { describe, expect, it } from 'vitest';
import { getEmbedProvider, isSafeStudioUrl, resolveStudioEmbedDestination, sanitizeStudioHtml } from '@vibress/studio-utils';

describe('context-specific URL policy (STU-401)', () => {
  it('retains mail and telephone links but removes them from media sources', () => {
    const html = sanitizeStudioHtml('<a href="mailto:editor@example.com">Mail</a><a href="tel:+123">Call</a><img src="mailto:editor@example.com"><video src="tel:+123"></video>');
    expect(html).toContain('href="mailto:editor@example.com"');
    expect(html).toContain('href="tel:+123"');
    expect(html).not.toContain('src="mailto:');
    expect(html).not.toContain('src="tel:');
  });

  it('limits inline raster data to explicitly allowed image HTML contexts', () => {
    const data = 'data:image/png;base64,iVBOR';
    expect(sanitizeStudioHtml(`<img src="${data}">`)).toContain(data);
    expect(sanitizeStudioHtml(`<a href="${data}">Image link</a><video src="${data}"></video>`)).not.toContain(data);
    expect(isSafeStudioUrl(data, 'image')).toBe(false);
    expect(isSafeStudioUrl(data, 'image', { allowDataImages: true })).toBe(true);
  });

  it.each(['javascript:alert(1)', 'java&#x73;cript:alert(1)', 'blob:https://example.com/id', 'https://', 'https://example.com/\npath'])('rejects unsafe/invalid media URL %#', url => {
    expect(isSafeStudioUrl(url, 'media')).toBe(false);
  });

  it('keeps supported relative/absolute URLs and optional length limits explicit', () => {
    for (const url of ['/media/asset.png', 'media/asset.png', 'https://example.com/a.png', '//cdn.example.com/a.png']) {
      expect(isSafeStudioUrl(url, 'media')).toBe(true);
    }
    expect(isSafeStudioUrl('https://example.com/' + 'x'.repeat(1000), 'link', { maxLength: 100 })).toBe(false);
    expect(isSafeStudioUrl('/media/image.png', 'media', { maxLength: NaN })).toBe(false);
    expect(isSafeStudioUrl('/media/image.png', 'media', { maxLength: 0 })).toBe(false);
    expect(isSafeStudioUrl('#image', 'media')).toBe(false);
  });

  it('does not turn incomplete provider links or non-HTTP destinations into iframe previews', () => {
    for (const url of ['https://youtu.be/', 'https://youtube.com/watch', 'https://youtube-nocookie.com/', 'https://vimeo.com/not-a-video', 'https://player.vimeo.com/not-a-video']) {
      expect(getEmbedProvider(url)).toBeNull();
      expect(resolveStudioEmbedDestination(url).kind).toBe('external-link');
    }
    expect(resolveStudioEmbedDestination('mailto:editor@example.com')).toEqual({ kind: 'invalid' });
  });
});
