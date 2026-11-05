import { useCallback, useState } from 'react';
import { $getNodeByKey, type LexicalEditor, type NodeKey } from 'lexical';
import { StudioCardNode } from '@vibress/studio-cards';
import type { StudioMediaApi } from '../media-context';
import type { useMediaRequestGuard } from './useMediaRequestGuard';
import { mergeDurableMediaAsset } from './mergeDurableMedia';

/** Shared single-card picker lifecycle, including synchronous host throws. */
export function useCardMediaPicker(
  editor: LexicalEditor, nodeKey: NodeKey, cardType: 'image' | 'video' | 'audio' | 'file',
  beginRequest: ReturnType<typeof useMediaRequestGuard>['beginRequest'],
  requestMedia: StudioMediaApi['requestMedia'], onStart: () => void
) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const pick = useCallback(async (source = 'library') => {
    if (!requestMedia || !editor.isEditable()) return;
    const isCurrent = beginRequest();
    onStart();
    setFailedSource(null);
    try {
      const payload = await requestMedia({ cardType, source });
      if (!isCurrent() || payload === null) return;
      // Validate before scheduling mutation so invalid URLs are visible failures.
      if (!payload || !mergeDurableMediaAsset({}, payload, cardType)) {
        setFailedSource(source);
        return;
      }
      editor.update(() => {
        if (!isCurrent()) return;
        const node = $getNodeByKey(nodeKey);
        if (!(node instanceof StudioCardNode) || !node.isAttached()) return;
        const next = mergeDurableMediaAsset(node.getCardData(), payload, cardType);
        if (next) node.setCardData(next);
      });
    } catch {
      if (isCurrent()) setFailedSource(source);
    }
  }, [editor, nodeKey, cardType, beginRequest, requestMedia, onStart]);
  return { pick, failedSource, dismiss: () => setFailedSource(null) };
}
