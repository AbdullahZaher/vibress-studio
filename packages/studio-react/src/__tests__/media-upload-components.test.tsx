import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { $getRoot, type LexicalEditor } from 'lexical';
import { StudioCardNode } from '@vibress/studio-cards';
import { createDefaultStudioDocument } from '@vibress/studio-core';
import { serializeStudioDocument } from '@vibress/studio-serializer';
import { VibressStudio, type VibressStudioProps } from '../VibressStudio';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function documentWithCard(cardType: string, src = '') {
  const document = createDefaultStudioDocument();
  document.root.children = [{ type: 'studio-card', version: 1, cardType,
    cardData: { src, alt: '', caption: '', captionHtml: '', width: 'regular',
      ...(cardType === 'gallery' ? { images: [] } : {}), ...(cardType === 'file' ? { fileName: '' } : {}),
    },
  }];
  return document;
}

function mount(cardType: string, props: Pick<VibressStudioProps, 'uploadMedia' | 'requestMedia'>, src = '') {
  let instance: LexicalEditor | null = null;
  const onEditorReady = (editor: LexicalEditor | null) => { instance = editor; };
  const onChange = vi.fn();
  const result = render(<VibressStudio value={documentWithCard(cardType, src)} {...props} onEditorReady={onEditorReady} onChange={onChange} />);
  const editor = () => {
    if (!instance) throw new Error('Editor did not initialize');
    return instance;
  };
  const chooseFile = (files = [new File(['asset'], 'asset.png', { type: 'image/png' })]) => {
    const input = result.container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('Actual card file control was not rendered');
    fireEvent.change(input, { target: { files } });
  };
  return { ...result, editor, chooseFile, onChange };
}

function readCard(editor: LexicalEditor) {
  return editor.getEditorState().read(() => {
    const node = $getRoot().getFirstChild();
    if (!(node instanceof StudioCardNode)) throw new Error('Card was lost');
    return node.getCardData();
  });
}

async function setCardSource(editor: LexicalEditor, src: string) {
  await act(async () => { editor.update(() => {
    const node = $getRoot().getFirstChild() as StudioCardNode;
    node.setCardData({ ...node.getCardData(), src, alt: 'Current author metadata', custom: { preserved: true } });
  }, { discrete: true }); });
}

describe.each(['image', 'video', 'audio', 'file'])('actual %s card upload lifecycle (STU-501/STU-502)', (cardType) => {
  it.each(['selected', 'canceled'])('releases a superseded upload after a %s library operation (CR-03)', async outcome => {
    const upload = deferred<Record<string, unknown> | null>();
    const picker = deferred<Record<string, unknown> | null>();
    const view = mount(cardType, { uploadMedia: () => upload.promise, requestMedia: () => picker.promise });
    view.chooseFile();
    await act(async () => {});
    // A card can become populated while its upload is pending (e.g. undo or
    // another editor integration). Exercise its actual library toolbar.
    const setSource = async (src: string) => { await act(async () => {
      view.editor().update(() => {
        const node = $getRoot().getFirstChild() as StudioCardNode;
        node.setCardData({ ...node.getCardData(), src, alt: 'Live metadata' });
      }, { discrete: true });
    }); };
    await setSource('/assets/current.png');
    fireEvent.click(screen.getByRole('button', { name: `Change ${cardType} from library` }));
    await act(async () => { picker.resolve(outcome === 'selected' ? { src: '/assets/library.png', assetId: 'library' } : null); await picker.promise; });
    expect(readCard(view.editor()).src).toBe(outcome === 'selected' ? '/assets/library.png' : '/assets/current.png');
    await act(async () => { upload.resolve({ src: '/assets/obsolete.png' }); await upload.promise; });
    expect(readCard(view.editor()).src).toBe(outcome === 'selected' ? '/assets/library.png' : '/assets/current.png');
    expect(readCard(view.editor()).alt).toBe('Live metadata');
    await setSource('');
    expect(screen.queryByText('Uploading...')).toBeNull();
    expect(view.container.querySelector<HTMLInputElement>('input[type="file"]')!.disabled).toBe(false);
  });

  it.each(['sync', 'async', 'invalid'])('handles %s picker failures after superseding an upload and allows retry', async failure => {
    const upload = deferred<Record<string, unknown> | null>();
    const requestMedia = vi.fn().mockImplementationOnce(() => {
      if (failure === 'sync') throw new Error('Synchronous host error');
      return failure === 'async' ? Promise.reject(new Error('Async host error')) : Promise.resolve({ src: 'javascript:alert(1)' });
    }).mockResolvedValueOnce({ src: '/assets/retry-library.png', assetId: 'retry-library' });
    const view = mount(cardType, { uploadMedia: () => upload.promise, requestMedia });
    view.chooseFile(); await act(async () => {});
    await setCardSource(view.editor(), '/assets/current.png');
    fireEvent.click(screen.getByRole('button', { name: `Change ${cardType} from library` }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Could not select media'));
    await act(async () => { upload.resolve({ src: '/assets/obsolete.png' }); await upload.promise; });
    expect(readCard(view.editor()).src).toBe('/assets/current.png');
    fireEvent.click(screen.getByRole('button', { name: 'Retry media selection' }));
    await waitFor(() => expect(readCard(view.editor()).src).toBe('/assets/retry-library.png'));
    expect(readCard(view.editor())).toMatchObject({ alt: 'Current author metadata', custom: { preserved: true }, assetId: 'retry-library' });
    expect(screen.queryByRole('alert')).toBeNull();
    await setCardSource(view.editor(), '');
    expect(screen.queryByText('Uploading...')).toBeNull();
  });

  it.each(['obsolete-first', 'newest-first'])('settles two uploads %s without stale overwrite or clearing a newer busy lease', async order => {
    const first = deferred<Record<string, unknown> | null>();
    const second = deferred<Record<string, unknown> | null>();
    const uploadMedia = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const view = mount(cardType, { uploadMedia, requestMedia: async () => null });
    view.chooseFile(); await act(async () => {});
    await setCardSource(view.editor(), '/assets/current.png');
    fireEvent.click(screen.getByRole('button', { name: `Change ${cardType} from library` }));
    await act(async () => {});
    await setCardSource(view.editor(), '');
    view.chooseFile(); await act(async () => {});
    expect(uploadMedia).toHaveBeenCalledTimes(2);
    const resolveFirst = async () => { await act(async () => { first.resolve({ src: '/assets/stale.png' }); await first.promise; }); };
    const resolveSecond = async () => { await act(async () => { second.resolve({ src: '/assets/newest.png', assetId: 'newest' }); await second.promise; }); };
    if (order === 'obsolete-first') {
      await resolveFirst();
      expect(screen.getByText('Uploading...')).toBeTruthy();
      expect(readCard(view.editor()).src).toBe('');
      await resolveSecond();
    } else { await resolveSecond(); await resolveFirst(); }
    expect(readCard(view.editor()).src).toBe('/assets/newest.png');
    await setCardSource(view.editor(), '');
    expect(screen.queryByText('Uploading...')).toBeNull();
    expect(view.container.querySelector<HTMLInputElement>('input[type="file"]')!.disabled).toBe(false);
  });

  it.each(['deleted', 'unmounted'])('ignores a late library completion after the card is %s', async outcome => {
    const picker = deferred<Record<string, unknown> | null>();
    const view = mount(cardType, { requestMedia: () => picker.promise }, '/assets/current.png');
    fireEvent.click(screen.getByRole('button', { name: `Change ${cardType} from library` }));
    const editor = view.editor();
    if (outcome === 'deleted') await act(async () => { editor.update(() => { $getRoot().clear(); }, { discrete: true }); });
    else view.unmount();
    const before = editor.getEditorState().toJSON(); const emissions = view.onChange.mock.calls.length;
    await act(async () => { picker.resolve({ src: '/assets/late.png' }); await picker.promise; });
    expect(editor.getEditorState().toJSON()).toEqual(before);
    expect(view.onChange).toHaveBeenCalledTimes(emissions);
  });

  it('treats an adapter cancellation as a no-op rather than an upload failure', async () => {
    const uploadMedia = vi.fn().mockResolvedValue(null);
    const view = mount(cardType, { uploadMedia });
    view.chooseFile();
    await waitFor(() => expect(uploadMedia).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(screen.queryByRole('alert')).toBeNull();
    expect(readCard(view.editor()).src).toBe('');
  });
  it('merges a durable result into current metadata and serializes/reloads its asset ID', async () => {
    const pending = deferred<Record<string, unknown> | null>();
    const view = mount(cardType, { uploadMedia: () => pending.promise });
    view.chooseFile();
    const editor = view.editor();
    await act(async () => {
      editor.update(() => {
        const node = $getRoot().getFirstChild();
        if (!(node instanceof StudioCardNode)) throw new Error('Missing media node');
        node.setCardData({ ...node.getCardData(), alt: 'Author alt', caption: 'وصف English', captionHtml: '<p>وصف English</p>', width: 'wide' });
      }, { discrete: true });
    });
    await act(async () => { pending.resolve({ assetId: 'durable-1', src: '/assets/new.png', alt: 'Stale alt', caption: 'Stale caption' }); await pending.promise; });
    await waitFor(() => expect(readCard(editor).src).toBe('/assets/new.png'));
    expect(readCard(editor)).toMatchObject({ assetId: 'durable-1', alt: 'Author alt', width: 'wide' });
    expect(JSON.stringify(readCard(editor).caption)).toContain('وصف English');
    const snapshot = serializeStudioDocument(editor.getEditorState().toJSON().root);
    const onReload = vi.fn();
    render(<VibressStudio value={JSON.stringify(snapshot)} onError={onReload} />);
    expect(onReload).not.toHaveBeenCalled();
    expect(JSON.stringify(snapshot)).toContain('durable-1');
    expect(JSON.stringify(snapshot)).not.toContain('blob:');
  });

  it('does not recreate a deleted card on late success', async () => {
    const pending = deferred<Record<string, unknown> | null>();
    const view = mount(cardType, { uploadMedia: () => pending.promise });
    view.chooseFile();
    const editor = view.editor();
    await act(async () => { editor.update(() => { $getRoot().getFirstChild()?.remove(); }, { discrete: true }); });
    await act(async () => { pending.resolve({ src: '/assets/late.png' }); await pending.promise; });
    expect(editor.getEditorState().toJSON().root.children).toEqual([]);
  });

  it('does not mutate a retained editor state or emit snapshots after unmount', async () => {
    const pending = deferred<Record<string, unknown> | null>();
    const view = mount(cardType, { uploadMedia: () => pending.promise });
    view.chooseFile();
    const editor = view.editor();
    const before = editor.getEditorState().toJSON();
    const emissions = view.onChange.mock.calls.length;
    view.unmount();
    await act(async () => { pending.resolve({ src: '/assets/late.png' }); await pending.promise; });
    expect(editor.getEditorState().toJSON()).toEqual(before);
    expect(view.onChange).toHaveBeenCalledTimes(emissions);
  });

  it('rejects a transient upload result and retries in the same card', async () => {
    const uploadMedia = vi.fn()
      .mockResolvedValueOnce({ src: 'blob:https://example.com/temporary' })
      .mockResolvedValueOnce({ assetId: 'retry-id', src: '/assets/retry.png' });
    const view = mount(cardType, { uploadMedia });
    view.chooseFile();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Upload failed'));
    expect(readCard(view.editor()).src).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(readCard(view.editor()).src).toBe('/assets/retry.png'));
    expect(uploadMedia).toHaveBeenCalledTimes(2);
    expect(view.editor().getEditorState().toJSON().root.children).toHaveLength(1);
  });
});

describe('image host adapter edge cases', () => {
  it('converts synchronous upload adapter exceptions into retryable errors', async () => {
    const view = mount('image', { uploadMedia: () => { throw new Error('Adapter failed'); } });
    view.chooseFile();
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Upload failed'));
    expect(readCard(view.editor()).src).toBe('');
  });

  it('never applies an older library selection after a newer selection completes', async () => {
    const first = deferred<Record<string, unknown> | null>();
    const second = deferred<Record<string, unknown> | null>();
    const requestMedia = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const view = mount('image', { requestMedia }, '/assets/original.png');
    fireEvent.click(screen.getByRole('button', { name: 'Change image from library' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change image from library' }));
    await act(async () => { second.resolve({ src: '/assets/newest.png' }); await second.promise; });
    await act(async () => { first.resolve({ src: '/assets/stale.png' }); await first.promise; });
    expect(readCard(view.editor()).src).toBe('/assets/newest.png');
  });
});

describe('actual gallery uploads', () => {
  it('retains an in-flight gallery upload when a concurrent picker addition completes', async () => {
    const upload = deferred<Record<string, unknown> | null>();
    const view = mount('gallery', { uploadMedia: () => upload.promise, requestMedia: async () => ({ src: '/assets/picked.png', assetId: 'picked' }) });
    view.chooseFile(); await act(async () => {});
    await act(async () => { view.editor().update(() => {
      const node = $getRoot().getFirstChild() as StudioCardNode;
      node.setCardData({ ...node.getCardData(), images: [{ src: '/assets/existing.png', alt: 'Existing' }] });
    }, { discrete: true }); });
    fireEvent.click(screen.getByRole('button', { name: 'Add images from library' }));
    await waitFor(() => expect(readCard(view.editor()).images).toHaveLength(2));
    await act(async () => { upload.resolve({ src: '/assets/uploaded.png', assetId: 'uploaded' }); await upload.promise; });
    await waitFor(() => expect(readCard(view.editor()).images).toHaveLength(3));
    expect((readCard(view.editor()).images as Array<{ src: string }>).map(x => x.src))
      .toEqual(['/assets/existing.png', '/assets/picked.png', '/assets/uploaded.png']);
  });

  it('does not present canceled files as failed uploads', async () => {
    const uploadMedia = vi.fn().mockResolvedValue(null);
    const view = mount('gallery', { uploadMedia });
    view.chooseFile();
    await waitFor(() => expect(uploadMedia).toHaveBeenCalledTimes(1));
    await act(async () => {});
    expect(screen.queryByRole('alert')).toBeNull();
    expect(readCard(view.editor()).images).toEqual([]);
  });
  it('ignores success after unmount', async () => {
    const pending = deferred<Record<string, unknown> | null>();
    const view = mount('gallery', { uploadMedia: () => pending.promise });
    view.chooseFile();
    const editor = view.editor();
    const before = editor.getEditorState().toJSON();
    view.unmount();
    await act(async () => { pending.resolve({ src: '/assets/late.png' }); await pending.promise; });
    expect(editor.getEditorState().toJSON()).toEqual(before);
  });

  it('retains successful images and retries only failed files without duplicate cards', async () => {
    const uploadMedia = vi.fn().mockResolvedValueOnce({ src: '/assets/one.png', assetId: 'one' })
      .mockRejectedValueOnce(new Error('Failed second file'))
      .mockResolvedValueOnce({ src: '/assets/two.png', assetId: 'two' });
    const view = mount('gallery', { uploadMedia });
    const first = new File(['first'], 'one.png', { type: 'image/png' });
    const second = new File(['second'], 'two.png', { type: 'image/png' });
    view.chooseFile([first, second]);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Upload failed for 1'));
    expect(readCard(view.editor()).images).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(readCard(view.editor()).images).toHaveLength(2));
    expect(uploadMedia).toHaveBeenNthCalledWith(3, second, 'gallery');
    expect(view.editor().getEditorState().toJSON().root.children).toHaveLength(1);
  });
});
