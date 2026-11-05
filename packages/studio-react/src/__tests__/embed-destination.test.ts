import { describe, expect, it } from 'vitest';
import { resolveStudioEmbedDestination } from '../components/cards/embed-destination';

describe('interactive embed source policy', () => {
  it('permits only provider-approved YouTube and Vimeo iframe URLs', () => {
    expect(resolveStudioEmbedDestination('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
      .toEqual({ kind: 'iframe', url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ' });
    expect(resolveStudioEmbedDestination('https://vimeo.com/123456'))
      .toEqual({ kind: 'iframe', url: 'https://player.vimeo.com/video/123456' });
  });

  it('never embeds unknown HTTPS websites in an iframe', () => {
    expect(resolveStudioEmbedDestination('https://example.org/page'))
      .toEqual({ kind: 'external-link', url: 'https://example.org/page' });
    expect(resolveStudioEmbedDestination('https://youtube.com.evil.test/video'))
      .toEqual({ kind: 'external-link', url: 'https://youtube.com.evil.test/video' });
  });

  it('blocks scripts, data URLs, local files, invalid URLs and control characters', () => {
    for (const url of [
      'javascript:alert(1)', 'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd', 'blob:https://example.com/s',
      'ftp://youtube.com/watch?v=id', 'not a URL', 'https://example.org/abc\n',
      '', null,
    ]) {
      expect(resolveStudioEmbedDestination(url)).toEqual({ kind: 'invalid' });
    }
  });
});
