import { describe, expect, it } from 'vitest';
import { appendGalleryImages } from '../utils/appendGalleryImages';

const original = { assetId: 'asset-1', src: '/media/photo.jpg?size=1', alt: 'Original', caption: 'Keep', custom: { x: 1 } };
describe('gallery append identity policy (CR-02)', () => {
  it.each([
    { assetId: 'asset-2', src: original.src, alt: 'Duplicate URL' },
    { assetId: original.assetId, src: '/media/changed.jpg', alt: 'Duplicate ID' },
    { src: original.src, alt: 'Legacy duplicate' },
  ])('rejects duplicate selection $alt without altering existing records', addition => {
    const input = [original, original];
    expect(appendGalleryImages(input, [addition])).toEqual(input);
    expect(appendGalleryImages(input, [addition])[0]).toBe(original);
  });
  it('retains distinct filenames, exact query strings, legacy entries and new metadata', () => {
    const legacy = { src: '/legacy/photo.jpg', alt: 'Legacy' };
    const additions = [
      { assetId: 'asset-2', src: '/other/photo.jpg?size=1', alt: 'Different directory', custom: true },
      { src: '/media/photo.jpg?size=2', alt: 'Different query' },
    ];
    expect(appendGalleryImages([original, legacy], [...additions, ...additions]))
      .toEqual([original, legacy, ...additions]);
  });
  it('does not collapse existing repetitions or mutate frozen input', () => {
    const existing = [Object.freeze(original), Object.freeze(original)];
    Object.freeze(existing);
    expect(appendGalleryImages(existing, [])).toEqual(existing);
  });
});
