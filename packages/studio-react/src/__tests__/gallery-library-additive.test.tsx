import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { $getRoot, LexicalEditor, UNDO_COMMAND, REDO_COMMAND } from 'lexical';
import { StudioDocument } from '@vibress/studio-core';
import { StudioCardNode } from '@vibress/studio-cards';
import { serializeStudioDocument } from '@vibress/studio-serializer';
import { VibressStudio } from '../VibressStudio';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function twoImageDocument(): StudioDocument {
  return {
    schema: 'vibress-studio',
    version: 1,
    editor: { lexicalVersion: '0.13.1' },
    root: {
      type: 'root',
      version: 1,
      children: [{
        type: 'studio-card',
        version: 1,
        cardType: 'gallery',
        cardData: {
          images: [
            { assetId: 'asset-1', src: '/media/one.jpg', alt: 'One' },
            { assetId: 'asset-2', src: '/media/two.jpg', alt: 'Two' },
          ],
          caption: 'Original caption',
          captionHtml: '<p>Original caption</p>',
          width: 'wide',
        },
      }],
    },
  };
}

function readGallery(editor: LexicalEditor): Record<string, unknown> {
  const snapshot = serializeStudioDocument(editor.getEditorState().toJSON().root);
  const gallery = snapshot.root.children.find((node) =>
    typeof node === 'object' && node !== null &&
    'type' in node && node.type === 'studio-card' &&
    'cardType' in node && node.cardType === 'gallery'
  );
  if (!gallery || typeof gallery !== 'object' || !('cardData' in gallery) ||
      !gallery.cardData || typeof gallery.cardData !== 'object' ||
      Array.isArray(gallery.cardData)) throw new Error('Gallery was lost');
  return gallery.cardData as Record<string, unknown>;
}

describe('GalleryCardEditor actual Lexical/media picker integration', () => {
  it('adds durable library images to latest state, preserving ordering and concurrent caption edits', async () => {
    const picker = deferred<Record<string, unknown> | null>();
    const requestMedia = vi.fn(() => picker.promise);
    let editor: LexicalEditor | null = null;
    const { container } = render(
      <VibressStudio
        value={twoImageDocument()}
        onEditorReady={(instance) => { editor = instance; }}
        requestMedia={requestMedia}
      />
    );
    await waitFor(() => expect(container.querySelectorAll('.vb-gallery-card img')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Add images from library' }));
    expect(requestMedia).toHaveBeenCalledWith({ cardType: 'gallery', source: 'library' });

    // The author edits the gallery while the library dialog is still pending.
    await act(async () => {
      editor!.update(() => {
        const node = $getRoot().getFirstChild();
        if (!(node instanceof StudioCardNode)) throw new Error('Missing gallery card');
        node.setCardData({
          ...node.getCardData(),
          caption: 'Edited while picker open',
          captionHtml: '<p>Edited while picker open</p>',
          width: 'full',
          unrelatedField: 'preserved',
        });
      }, { discrete: true });
    });

    await act(async () => {
      picker.resolve({ images: [
        { assetId: 'asset-2', src: '/media/two.jpg', alt: 'Duplicate' },
        { assetId: 'asset-3', src: '/media/three.jpg', alt: 'Three' },
        { src: 'blob:https://example.com/transient', alt: 'Invalid' },
      ] });
      await picker.promise;
    });

    await waitFor(() => expect(container.querySelectorAll('.vb-gallery-card img')).toHaveLength(3));
    const data = readGallery(editor!);
    expect((data.images as Array<{ assetId?: string }>).map((img) => img.assetId))
      .toEqual(['asset-1', 'asset-2', 'asset-3']);
    expect(JSON.stringify(data.caption)).toContain('Edited while picker open');
    expect(String(data.captionHtml)).toContain('Edited while picker open');
    expect(data.width).toBe('full');
    expect(data.unrelatedField).toBe('preserved');
    // The actual published/persisted envelope also remains reloadable.
    expect(serializeStudioDocument(editor!.getEditorState().toJSON().root).schema).toBe('vibress-studio');
  });

  it('deduplicates by either exact URL or durable ID, retaining existing repeated entries and history (CR-02)', async () => {
    let editor: LexicalEditor | null = null;
    const doc = twoImageDocument();
    const view = render(<VibressStudio value={doc} requestMedia={async () => ({ images: [
      { assetId: 'other-id', src: '/media/one.jpg', alt: 'Same URL' },
      { assetId: 'asset-2', src: '/media/changed.jpg', alt: 'Same ID' },
      { src: '/media/two.jpg', alt: 'Legacy duplicate' },
      { assetId: 'new', src: '/other/one.jpg?size=large', alt: 'Distinct asset' },
      { assetId: 'new', src: '/other/changed.jpg', alt: 'Same selection twice' },
    ] })} onEditorReady={(instance) => { editor = instance; }} />);
    await waitFor(() => expect(view.container.querySelectorAll('.vb-gallery-card img')).toHaveLength(2));
    // Existing authored repetitions must never be removed by a picker append.
    await act(async () => { editor!.update(() => {
      const node = $getRoot().getFirstChild() as StudioCardNode;
      const data = node.getCardData();
      node.setCardData({ ...data, images: [...data.images as unknown[], (data.images as unknown[])[0]], custom: { retained: true } });
    }, { discrete: true, tag: 'history-push' }); });
    fireEvent.click(screen.getByRole('button', { name: 'Add images from library' }));
    await waitFor(() => expect(view.container.querySelectorAll('.vb-gallery-card img')).toHaveLength(4));
    const saved = serializeStudioDocument(editor!.getEditorState().toJSON().root);
    expect((readGallery(editor!).images as Array<{ src: string }>).map(x => x.src))
      .toEqual(['/media/one.jpg', '/media/two.jpg', '/media/one.jpg', '/other/one.jpg?size=large']);
    expect(readGallery(editor!).custom).toEqual({ retained: true });
    await act(async () => { editor!.dispatchCommand(UNDO_COMMAND, undefined); });
    expect(readGallery(editor!).images).toHaveLength(3);
    await act(async () => { editor!.dispatchCommand(REDO_COMMAND, undefined); });
    expect(readGallery(editor!).images).toHaveLength(4);
    view.unmount();
    const reload = render(<VibressStudio value={JSON.stringify(saved)} />);
    await waitFor(() => expect(reload.container.querySelectorAll('.vb-gallery-card img')).toHaveLength(4));
  });

  it('keeps concurrent gallery additions additive in completion order and preserves current metadata', async () => {
    const first = deferred<Record<string, unknown> | null>(); const second = deferred<Record<string, unknown> | null>();
    const requestMedia = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    let editor: LexicalEditor | null = null;
    const view = render(<VibressStudio value={twoImageDocument()} requestMedia={requestMedia}
      onEditorReady={instance => { editor = instance; }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add images from library' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add images from library' }));
    await act(async () => { second.resolve({ src: '/media/second.jpg', assetId: 'second' }); await second.promise; });
    await act(async () => { first.resolve({ src: '/media/first.jpg', assetId: 'first' }); await first.promise; });
    expect((readGallery(editor!).images as Array<{ assetId: string }>).map(x => x.assetId))
      .toEqual(['asset-1', 'asset-2', 'second', 'first']);
    expect(readGallery(editor!).width).toBe('wide');
    expect(view.container.querySelectorAll('.vb-gallery-card img')).toHaveLength(4);
  });

  it('does not mutate on picker cancel or resurrect a removed gallery on delayed completion', async () => {
    const picker = deferred<Record<string, unknown> | null>();
    let editor: LexicalEditor | null = null;
    const { container } = render(
      <VibressStudio value={twoImageDocument()}
        onEditorReady={(instance) => { editor = instance; }}
        requestMedia={() => picker.promise}
      />
    );
    await waitFor(() => expect(container.querySelectorAll('.vb-gallery-card img')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Add images from library' }));
    await act(async () => {
      editor!.update(() => { $getRoot().clear(); }, { discrete: true });
    });
    await act(async () => {
      picker.resolve({ images: [{ assetId: 'late', src: '/media/late.jpg', alt: 'Late' }] });
      await picker.promise;
    });
    await waitFor(() => expect(container.querySelectorAll('.vb-gallery-card img')).toHaveLength(0));
    let children = 1;
    editor!.getEditorState().read(() => { children = $getRoot().getChildren().length; });
    expect(children).toBe(0);
  });

  it('treats cancellation as a no-op on the persisted gallery', async () => {
    let editor: LexicalEditor | null = null;
    const { container } = render(
      <VibressStudio value={twoImageDocument()}
        onEditorReady={(instance) => { editor = instance; }}
        requestMedia={async () => null}
      />
    );
    await waitFor(() => expect(container.querySelectorAll('.vb-gallery-card img')).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Add images from library' }));
    await act(async () => {});
    expect((readGallery(editor!).images as unknown[])).toHaveLength(2);
  });
});
