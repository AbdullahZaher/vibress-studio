import { useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { NodeKey, $getNodeByKey } from 'lexical';
import { ImageCardData } from '@vibress/studio-cards';
import { NestedCaptionEditor } from './NestedCaptionEditor.js';
import { CardPlaceholder } from '../ui/CardPlaceholder.js';

import { useStudioUploadAdapter } from '../../media/UploadAdapterContext.js';
import { assertCardSelection } from '../../utils/cardSelection.js';
import { createObjectUrl } from '../../media/object-url.js';
import { useMediaUpload } from '../../media/useMediaUpload.js';

interface Props {
  nodeKey: NodeKey;
  cardData: ImageCardData;
}

export function ImageCardEditor({ nodeKey, cardData }: Props) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const adapter = useStudioUploadAdapter();

  const { status, progress, error, asset, previewUrl, upload, retry, clear } = useMediaUpload({
    adapter,
    cardType: 'image',
    onSuccess: (uploaded) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node && 'setCardData' in node) {
          (node as { setCardData(data: Record<string, unknown>): void }).setCardData({
            ...cardData,
            src: uploaded.url,
            assetId: uploaded.id,
            alt: uploaded.alt || cardData.alt || '',
            height: uploaded.height,
          });
        }
      });
    },
  });

  // The hook revokes any preview object URL on unmount automatically.

  const isPopulated = !!cardData.src || !!previewUrl;

  const onFileSelect = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    // No adapter: store the local preview src so the card shows the image.
    if (!adapter) {
      const previewUrl = createObjectUrl(file);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node && 'setCardData' in node) {
          (node as { setCardData(data: Record<string, unknown>): void }).setCardData({
            ...cardData,
            src: previewUrl,
            alt: file.name,
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

  const widthClass = cardData.width && cardData.width !== 'regular' ? ` vb-width-${cardData.width}` : '';

  if (!isPopulated) {
    return (
      <CardPlaceholder
        iconType="image"
        title="Image"
        description="Click to select an image, or drag and drop"
        onFileSelect={onFileSelect}
        isSelected={isSelected}
        onClick={() => assertCardSelection(clearSelection, setSelected)}
      />
    );
  }

  const displaySrc = previewUrl || asset?.url || cardData.src;

  return (
    <figure
      className={`vb-image-card${widthClass} relative`}
      onClick={() => assertCardSelection(clearSelection, setSelected)}
      style={{
        outline: isSelected ? '2px solid #3b82f6' : 'none',
        borderRadius: '4px',
        transition: 'outline 0.1s ease',
      }}
    >
      {status === 'uploading' && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/70 rounded">
          <div className="text-xs text-gray-600 mb-1">Uploading… {progress}%</div>
          <div className="w-40 h-1.5 bg-gray-200 rounded overflow-hidden">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}
      {status === 'error' && (
        <div role="alert" className="absolute inset-x-0 top-0 z-10 flex flex-col gap-1.5 items-center justify-center bg-red-50 border border-red-200 rounded p-3">
          <p className="text-xs text-red-700">Upload failed: {error}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void retry()}
              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={clear}
              className="px-2 py-1 text-xs bg-white border border-red-300 text-red-700 rounded hover:bg-red-100"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      <img src={displaySrc} alt={cardData.alt || ''} className="w-full" />
      <NestedCaptionEditor
        initialCaptionJSON={typeof cardData.caption === 'object' ? cardData.caption : undefined}
        onChange={onCaptionChange}
        placeholder="Type caption for image (optional)"
      />
    </figure>
  );
}
