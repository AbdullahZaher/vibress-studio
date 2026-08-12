import { useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { NodeKey } from 'lexical';
import { VideoCardData } from '@vibress/studio-cards';
import { NestedCaptionEditor } from './NestedCaptionEditor.js';
import { $getNodeByKey } from 'lexical';
import { CardPlaceholder } from '../ui/CardPlaceholder.js';
import { UploadStatusOverlay } from '../ui/UploadStatusOverlay.js';

import { useStudioUploadAdapter } from '../../media/UploadAdapterContext.js';
import { assertCardSelection } from '../../utils/cardSelection.js';
import { createObjectUrl } from '../../media/object-url.js';
import { useMediaUpload } from '../../media/useMediaUpload.js';

interface Props {
  nodeKey: NodeKey;
  cardData: VideoCardData;
}

export function VideoCardEditor({ nodeKey, cardData }: Props) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const adapter = useStudioUploadAdapter();

  const { status, progress, error, asset, previewUrl, upload, retry, clear } = useMediaUpload({
    adapter,
    cardType: 'video',
    onSuccess: (uploaded) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node && 'setCardData' in node) {
          (node as { setCardData(data: Record<string, unknown>): void }).setCardData({
            ...cardData,
            src: uploaded.url,
            assetId: uploaded.id,
          });
        }
      });
    },
  });

  const isPopulated = !!cardData.src || !!previewUrl;

  const onFileSelect = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!adapter) {
      const url = createObjectUrl(file);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node && 'setCardData' in node) {
          (node as { setCardData(data: Record<string, unknown>): void }).setCardData({
            ...cardData,
            src: url,
            fileName: file.name,
          });
        }
      });
      return;
    }
    void upload(file);
  };

  const onCaptionChange = useCallback(
    (captionJSON: Record<string, unknown>, captionHtml: string) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node && 'setCardData' in node) {
          (node as { setCardData(data: Record<string, unknown>): void }).setCardData({
            ...cardData,
            caption: captionJSON,
            captionHtml,
          });
        }
      });
    },
    [editor, nodeKey, cardData]
  );

  if (!isPopulated) {
    return (
      <CardPlaceholder
        iconType="video"
        title="Video"
        description="Click to select a video file"
        onFileSelect={onFileSelect}
        isSelected={isSelected}
        onClick={() => assertCardSelection(clearSelection, setSelected)}
      />
    );
  }

  const displaySrc = previewUrl || asset?.url || cardData.src;

  return (
    <figure
      className="vb-video-card relative w-full mb-4"
      onClick={() => assertCardSelection(clearSelection, setSelected)}
      style={{
        outline: isSelected ? '2px solid #3b82f6' : 'none',
        borderRadius: '4px',
        transition: 'outline 0.1s ease',
      }}
    >
      <UploadStatusOverlay
        state={{ status, progress, error }}
        onRetry={() => void retry()}
        onDismiss={clear}
      />
      <video src={displaySrc} controls className="w-full" />
      <NestedCaptionEditor
        initialCaptionJSON={typeof cardData.caption === 'object' ? cardData.caption : undefined}
        onChange={onCaptionChange}
        placeholder="Type caption for video (optional)"
      />
    </figure>
  );
}
