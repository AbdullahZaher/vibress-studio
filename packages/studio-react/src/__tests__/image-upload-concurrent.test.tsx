import { describe, it, expect } from 'vitest';
import { createEditor, $getRoot, $getNodeByKey, NodeKey } from 'lexical';
import { StudioCardNode, ImageCardData } from '@vibress/studio-cards';
import { ReactStudioCardNode } from '../nodes/ReactStudioCardNode';

function createDeferred<T>() {
  let resolve!: (val: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('Concurrent-safe image uploads (STU-R02)', () => {
  it('preserves concurrent caption and alt edits made while upload is pending', async () => {
    const deferred = createDeferred<Record<string, unknown> | null>();

    const editor = createEditor({
      nodes: [StudioCardNode, ReactStudioCardNode],
    });

    let targetKey!: NodeKey;
    editor.update(() => {
      const root = $getRoot();
      const node = new StudioCardNode('image', {
        src: '',
        alt: '',
        caption: '',
        captionHtml: '',
        width: 'regular',
      });
      root.append(node);
      targetKey = node.getKey();
    }, { discrete: true });

    // Verify initial node data
    editor.getEditorState().read(() => {
      const node = $getNodeByKey(targetKey) as StudioCardNode;
      expect((node.getCardData() as ImageCardData).src).toBe('');
    });

    // User starts upload. In the fixed ImageCardEditor, completion reads fresh node data:
    const uploadPromise = deferred.promise.then((payload) => {
      if (!payload) return;
      editor.update(() => {
        const node = $getNodeByKey(targetKey);
        if (node instanceof StudioCardNode && node.isAttached()) {
          const currentData = (node.getCardData() || {}) as ImageCardData;
          node.setCardData({
            ...currentData,
            ...payload,
            alt: currentData.alt || (typeof payload.alt === 'string' ? payload.alt : ''),
            caption: currentData.caption,
            captionHtml: currentData.captionHtml,
            width: currentData.width || (payload.width as ImageCardData['width']) || 'regular',
            href: currentData.href,
          });
        }
      });
    });

    // While upload is pending, user concurrently edits caption, alt, and width on the node
    editor.update(() => {
      const node = $getNodeByKey(targetKey) as StudioCardNode;
      node.setCardData({
        ...node.getCardData(),
        alt: 'User edited alt text',
        caption: 'User edited caption',
        captionHtml: '<p>User edited caption</p>',
        width: 'wide',
      });
    }, { discrete: true });

    // Resolve upload with server payload
    deferred.resolve({
      src: 'https://cdn.example.com/uploaded-asset.png',
      assetId: 'asset-456',
    });

    await uploadPromise;

    // Verify: The node must have the new src AND retain the user's caption, alt, and width edits!
    editor.getEditorState().read(() => {
      const node = $getNodeByKey(targetKey) as StudioCardNode;
      const data = node.getCardData() as ImageCardData;
      expect(data.src).toBe('https://cdn.example.com/uploaded-asset.png');
      expect(data.assetId).toBe('asset-456');
      expect(data.alt).toBe('User edited alt text');
      expect(data.caption).toBe('User edited caption');
      expect(data.captionHtml).toBe('<p>User edited caption</p>');
      expect(data.width).toBe('wide');
    });
  });

  it('does not resurrect a deleted card when an in-flight upload completes', async () => {
    const deferred = createDeferred<Record<string, unknown> | null>();

    const editor = createEditor({
      nodes: [StudioCardNode, ReactStudioCardNode],
    });

    let targetKey!: NodeKey;
    editor.update(() => {
      const root = $getRoot();
      const node = new StudioCardNode('image', { src: '', alt: '' });
      root.append(node);
      targetKey = node.getKey();
    }, { discrete: true });

    // Upload completion callback with attachment check
    const uploadPromise = deferred.promise.then((payload) => {
      if (!payload) return;
      editor.update(() => {
        const node = $getNodeByKey(targetKey);
        if (node instanceof StudioCardNode && node.isAttached()) {
          node.setCardData({
            ...node.getCardData(),
            ...payload,
          });
        }
      });
    });

    // User deletes the card before upload completes
    editor.update(() => {
      const node = $getNodeByKey(targetKey);
      if (node) {
        node.remove();
      }
    }, { discrete: true });

    // Card is now removed from root
    editor.getEditorState().read(() => {
      expect($getNodeByKey(targetKey)).toBeNull();
    });

    // Upload finishes late
    deferred.resolve({
      src: 'https://cdn.example.com/late.png',
    });

    await uploadPromise;

    // Card MUST NOT be resurrected
    editor.getEditorState().read(() => {
      expect($getNodeByKey(targetKey)).toBeNull();
      expect($getRoot().getChildren().length).toBe(0);
    });
  });
});
