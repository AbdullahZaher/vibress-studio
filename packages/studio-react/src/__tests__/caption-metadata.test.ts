import { describe, expect, it } from 'vitest';
import { captionMetadataPatch } from '../components/cards/caption-metadata';

describe('caption metadata updates', () => {
  it('preserves rich Lexical JSON and formatting when unrelated metadata changes', () => {
    const richCaption = { root: { type: 'root', children: [
      { type: 'paragraph', children: [{ type: 'text', text: 'Hello', format: 1 }] },
    ] } };
    const current = { caption: richCaption, captionHtml: '<p><strong>Hello</strong></p>' };
    const patch = captionMetadataPatch(current, current.captionHtml);
    expect(patch).toEqual({});
    expect({ ...current, alt: 'Updated alt', ...patch }.caption).toBe(richCaption);
  });

  it('preserves legacy text and unknown caption JSON on metadata-only edits', () => {
    expect(captionMetadataPatch({ caption: 'Hello' }, 'Hello')).toEqual({});
    expect(captionMetadataPatch({ caption: { unknown: 'retain' } }, '')).toEqual({});
  });

  it('updates caption text only when the author changes that input', () => {
    expect(captionMetadataPatch({ caption: 'Before' }, 'After')).toEqual({
      caption: 'After', captionHtml: 'After',
    });
  });
});
