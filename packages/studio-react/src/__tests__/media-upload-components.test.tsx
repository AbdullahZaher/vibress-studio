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

describe.each(['image', 'video', 'audio', 'file'])('actual %s card upload lifecycle (STU-501/STU-502)', (cardType) => {
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
