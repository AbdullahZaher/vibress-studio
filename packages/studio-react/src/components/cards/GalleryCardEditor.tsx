import { useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { NodeKey } from 'lexical';
import { GalleryCardData } from '@vibress/studio-cards';
import { NestedCaptionEditor } from './NestedCaptionEditor.js';
import { $getNodeByKey } from 'lexical';
import { CardPlaceholder } from '../ui/CardPlaceholder.js';
import { UploadStatusOverlay } from '../ui/UploadStatusOverlay.js';

import { useStudioUploadAdapter } from '../../media/UploadAdapterContext.js';
import { createObjectUrl } from '../../media/object-url.js';
import { useMediaUpload } from '../../media/useMediaUpload.js';

interface Props {
  nodeKey: NodeKey;
  cardData: GalleryCardData;
}

export function GalleryCardEditor({ nodeKey, cardData }: Props) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const adapter = useStudioUploadAdapter();

  const { status, progress, error, upload, retry, clear } = useMediaUpload({
    adapter,
    cardType: 'gallery',
    onSuccess: (uploaded) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node && 'setCardData' in node) {
          (node as { setCardData(data: Record<string, unknown>): void }).setCardData({
            ...cardData,
            images: [
              ...(cardData.images || []),
              { src: uploaded.url, alt: uploaded.alt || '' },
            ],
          });
        }
      });
    },
  });

  const isPopulated = !!cardData.images && cardData.images.length > 0;

  const onFileSelect = (files: File[]) => {
    if (files.length === 0) return;
    if (!adapter) {
      const newImages = files.map((file) => ({
        src: createObjectUrl(file),
        alt: file.name,
      }));
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node && 'setCardData' in node) {
          (node as { setCardData(data: Record<string, unknown>): void }).setCardData({
            ...cardData,
            images: [...(cardData.images || []), ...newImages],
          });
        }
      });
      return;
    }
    // Upload sequentially so each persisted asset is appended in order.
    void (async () => {
      for (const file of files) {
        await upload(file);
      }
    })();
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
        iconType="gallery"
        title="Gallery"
        description="Click to select images, or drag and drop"
        onFileSelect={onFileSelect}
        multiple={true}
        isSelected={isSelected}
        onClick={() => {
          clearSelection();
          setSelected(true);
        }}
      />
    );
  }

  return (
    <figure
      className={`vb-gallery-card${widthClass} relative`}
      onClick={() => {
        clearSelection();
        setSelected(true);
      }}
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
      <div className="flex flex-wrap gap-2">
        {cardData.images.map((img, i) => (
          <img key={i} src={img.src} alt={img.alt || ''} className="flex-1 object-cover min-w-[200px]" style={{ maxHeight: '300px' }} />
        ))}
      </div>
      <NestedCaptionEditor
        initialCaptionJSON={typeof cardData.caption === 'object' ? cardData.caption : undefined}
        onChange={onCaptionChange}
        placeholder="Type caption for gallery (optional)"
      />
    </figure>
  );
}
