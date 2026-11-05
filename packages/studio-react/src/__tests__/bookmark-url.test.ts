import { describe, expect, it } from 'vitest';
import { isSafeBookmarkImageUrl, parseSafeBookmarkUrl } from '../components/cards/bookmark-url';

describe('bookmark editor URL policy', () => {
  it('extracts host metadata only from valid HTTP(S) bookmarks', () => {
    expect(parseSafeBookmarkUrl('https://www.example.com/story'))
      .toEqual({ href: 'https://www.example.com/story', hostname: 'www.example.com' });
    expect(parseSafeBookmarkUrl('http://localhost:4000/post'))
      .toEqual({ href: 'http://localhost:4000/post', hostname: 'localhost' });
  });

  it('never attempts to navigate or parse untrusted invalid bookmark URLs', () => {
    for (const input of [null, '', '/', 'invalid URL', 'javascript:alert(1)',
      'data:text/html,<h1>x</h1>', 'file:///etc/passwd', 'https://example.com\n']) {
      expect(parseSafeBookmarkUrl(input)).toBeNull();
    }
  });

  it('does not load executable or temporary bookmark thumbnails and icons', () => {
    for (const src of ['javascript:alert(1)', 'blob:http://localhost/asset',
      'data:image/png;base64,AAA=', 'mailto:someone@example.com', '#']) {
      expect(isSafeBookmarkImageUrl(src)).toBe(false);
    }
    expect(isSafeBookmarkImageUrl('https://cdn.example.org/icon.png')).toBe(true);
    expect(isSafeBookmarkImageUrl('/media/image.png')).toBe(true);
  });
});
