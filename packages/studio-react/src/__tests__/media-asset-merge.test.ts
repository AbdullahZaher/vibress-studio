import { describe, expect, it } from 'vitest';
import { isDurableMediaUrl, mergeDurableMediaAsset } from '../utils/mergeDurableMedia';

describe('media payload boundary: durable URL and author-owned fields', () => {
  it('never pairs a new source URL with the previous asset ID', () => {
    const original = { src: '/old.png', assetId: 'old-id', caption: 'Keep' };
    const replaced = mergeDurableMediaAsset(original, { src: '/external.png' }, 'image');
    expect(replaced).toEqual({ src: '/external.png', caption: 'Keep' });
    expect(mergeDurableMediaAsset(original, { src: '/old.png' }, 'image')?.assetId).toBe('old-id');
  });
  it('accepts host-provided permanent absolute and relative media references', () => {
    for (const url of [
      'https://cdn.example.com/asset.png',
      'http://localhost:5173/mock/assets/42',
      '/mock/assets/42',
      'media/image.png',
      '//cdn.example.com/asset.png',
    ]) {
      expect(isDurableMediaUrl(url)).toBe(true);
    }
  });

  it('rejects transient, executable, empty, and non-media protocol URLs', () => {
    for (const url of [
      'blob:http://localhost:5173/temporary',
      'data:image/png;base64,AAAB',
      'javascript:alert(1)',
      'file:///etc/passwd',
      'mailto:editor@example.com',
      'tel:+12345',
      '#',
      '',
      'https://example.com/image.png\n',
    ]) {
      expect(isDurableMediaUrl(url)).toBe(false);
      expect(mergeDurableMediaAsset({ caption: 'keep' }, { src: url }, 'image')).toBeNull();
    }
  });

  it('keeps edited captions, links, image alt, and layout across stale image data', () => {
    const caption = { root: { type: 'root', children: [{ type: 'text', text: 'New edit' }] } };
    const current = {
      caption, captionHtml: '<p>New edit</p>', alt: 'User alt',
      href: 'https://author.example/story', width: 'wide', src: '',
    };
    const payload = {
      src: 'https://cdn.example/new.png', assetId: 'asset-456',
      caption: 'Stale caption', captionHtml: 'Stale', alt: 'Old alt',
      href: 'javascript:alert(1)', width: 'regular', unknown: 'unsafe extra',
    };
    expect(mergeDurableMediaAsset(current, payload, 'image')).toEqual({
      ...current, src: 'https://cdn.example/new.png', assetId: 'asset-456',
    });
  });

  it('preserves concurrent audio/video/file metadata while replacing media', () => {
    const data = {
      src: '/old/media', caption: 'Author caption',
      captionHtml: '<p>Author caption</p>', title: 'Edited title',
      fileName: 'Edited filename.pdf', poster: '/author/poster.jpg',
      width: 'full', loop: true, autoplay: false,
    };
    const payload = {
      src: '/new/media', assetId: 'asset-new',
      caption: 'Stale caption', captionHtml: '<p>Stale</p>',
      title: 'Stale title', fileName: 'Stale filename',
      width: 'regular', poster: '/stale/poster.png',
      loop: false, autoplay: true, dangerousExtra: 'ignore',
    };
    for (const kind of ['audio', 'video', 'file'] as const) {
      const merged = mergeDurableMediaAsset(data, payload, kind);
      expect(merged).toEqual({ ...data, src: '/new/media', assetId: 'asset-new' });
    }
  });

  it('sets original file labels only while author fields are empty', () => {
    expect(mergeDurableMediaAsset({ src: '', title: '' }, { src: '/audio/1', title: 'stale' }, 'audio', 'voice.mp3'))
      .toMatchObject({ src: '/audio/1', title: 'voice.mp3' });
    expect(mergeDurableMediaAsset({ src: '', fileName: '', fileSize: '' },
      { src: '/files/1', fileName: 'stale', fileSize: '2048' }, 'file', 'report.pdf'))
      .toMatchObject({ src: '/files/1', fileName: 'report.pdf', fileSize: '2048' });
    expect(mergeDurableMediaAsset({ src: '', width: 'regular', alt: '' },
      { src: '/images/1', alt: 'Provider alt', width: 1280, height: 720 }, 'image'))
      .toMatchObject({ src: '/images/1', alt: 'Provider alt', width: 'regular', height: 720 });
  });
});
