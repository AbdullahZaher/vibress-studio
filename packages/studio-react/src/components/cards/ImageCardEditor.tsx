import { useCallback, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { NodeKey, $getNodeByKey } from 'lexical';
import { ImageCardData, StudioCardNode } from '@vibress/studio-cards';

import { NestedCaptionEditor } from './NestedCaptionEditor';
import { captionMetadataPatch } from './caption-metadata';
import { CardPlaceholder } from '../ui/CardPlaceholder';
import { useStudioMedia } from '../../media-context';
import { isDurableMediaUrl, mergeDurableMediaAsset } from '../../utils/mergeDurableMedia';
import { useMediaRequestGuard } from '../../utils/useMediaRequestGuard';
import { StudioMediaFloatingToolbar } from '../ui/StudioMediaFloatingToolbar';
import { ImageMetadataPopover } from '../ui/media-popovers/ImageMetadataPopover';

interface Props {
  nodeKey: NodeKey;
  cardData: ImageCardData;
}

export function ImageCardEditor({ nodeKey, cardData }: Props) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const { uploadMedia, requestMedia, allowUnsplash } = useStudioMedia();
  const [uploading, setUploading] = useState(false);
  const beginRequest = useMediaRequestGuard();
  const [uploadError, setUploadError] = useState(false);
  const [lastFile, setLastFile] = useState<File | null>(null);

  const isPopulated = !!cardData.src;

  const attemptUpload = (file: File) => {
    if (!uploadMedia || uploading || !editor.isEditable()) return;
    const isCurrent = beginRequest();
    setLastFile(file);
    setUploadError(false);
    setUploading(true);
    Promise.resolve().then(() => isCurrent() ? uploadMedia(file, 'image') : null)
      .then((payload) => {
        if (!isCurrent()) return;
        if (payload === null) return; // Host cancellation is a no-op.
        if (!payload || !isDurableMediaUrl(payload.src)) {
          setUploadError(true);
          return;
        }
        editor.update(() => {
          if (!isCurrent()) return;
          const node = $getNodeByKey(nodeKey);
          if (node instanceof StudioCardNode && node.isAttached()) {
            const next = mergeDurableMediaAsset(node.getCardData(), payload, 'image');
            if (next) node.setCardData(next);
          }
        });
      })
      .catch(() => { if (isCurrent()) setUploadError(true); })
      .finally(() => { if (isCurrent()) setUploading(false); });
  };

  const onFileSelect = (files: File[]) => {
    const file = files[0];
    if (file) attemptUpload(file);
  };

  const handleChangeFromLibrary = useCallback(async () => {
    if (!requestMedia || !editor.isEditable()) return;
    const isCurrent = beginRequest();
    const payload = await requestMedia({
      cardType: 'image',
      source: 'library',
    });
    if (!isCurrent() || !payload || !isDurableMediaUrl(payload.src)) return;
    editor.update(() => {
          if (!isCurrent()) return;
      const node = $getNodeByKey(nodeKey);
      if (node instanceof StudioCardNode && node.isAttached()) {
        const next = mergeDurableMediaAsset(node.getCardData(), payload, 'image');
        if (next) node.setCardData(next);
      }
    });
  }, [editor, nodeKey, requestMedia, beginRequest]);

  const handleUnsplash = useCallback(async () => {
    if (!requestMedia || !editor.isEditable()) return;
    const isCurrent = beginRequest();
    const payload = await requestMedia({
      cardType: 'image',
      source: 'unsplash',
    });
    if (!isCurrent() || !payload || !isDurableMediaUrl(payload.src)) return;
    editor.update(() => {
          if (!isCurrent()) return;
      const node = $getNodeByKey(nodeKey);
      if (node instanceof StudioCardNode && node.isAttached()) {
        const next = mergeDurableMediaAsset(node.getCardData(), payload, 'image');
        if (next) node.setCardData(next);
      }
    });
  }, [editor, nodeKey, requestMedia, beginRequest]);

  const handleMetadataUpdate = useCallback(
    (data: { alt: string; caption: string; href?: string | undefined }) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node instanceof StudioCardNode && node.isAttached()) {
          const currentData = (node.getCardData() || {}) as ImageCardData;
          node.setCardData({
            ...currentData,
            alt: data.alt,
            ...captionMetadataPatch(node.getCardData(), data.caption),
            href: data.href,
          });
        }
      });
    },
    [editor, nodeKey]
  );

  const handleWidthChange = useCallback(
    (newWidth: 'regular' | 'wide' | 'full') => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node instanceof StudioCardNode && node.isAttached()) {
          const currentData = (node.getCardData() || {}) as ImageCardData;
          node.setCardData({
            ...currentData,
            width: newWidth,
          });
        }
      });
    },
    [editor, nodeKey]
  );

  const handleDelete = useCallback(() => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node && node.isAttached()) {
        node.remove();
      }
    });
  }, [editor, nodeKey]);

  const onCaptionChange = useCallback(
    (captionJSON: Record<string, unknown>, captionHtml: string) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node instanceof StudioCardNode && node.isAttached()) {
          const currentData = (node.getCardData() || {}) as ImageCardData;
          node.setCardData({
            ...currentData,
            caption: captionJSON,
            captionHtml,
          });
        }
      });
    },
    [editor, nodeKey]
  );

  const widthClass =
    typeof cardData.width === 'string' && cardData.width !== 'regular'
      ? ` vb-width-${cardData.width}`
      : '';

  if (!isPopulated) {
    return (
      <div>
        <CardPlaceholder
          iconType="image"
          title="Image"
          description="Click to select an image, or drag and drop"
          onFileSelect={onFileSelect}
          uploading={uploading}
          isSelected={isSelected}
          onClick={() => {
            clearSelection();
            setSelected(true);
          }}
        />
        {uploadError && (
          <div role="alert" aria-live="polite" className="my-2 text-sm text-red-700">
            Upload failed.
            <button
              type="button"
              className="mx-2 underline"
              onClick={() => {
                if (lastFile) attemptUpload(lastFile);
              }}
              disabled={uploading}
            >
              Retry
            </button>
            <button type="button" className="underline" onClick={() => setUploadError(false)}>
              Dismiss
            </button>
          </div>
        )}
      </div>
    );
  }

  const captionStr =
    typeof cardData.caption === 'string'
      ? cardData.caption
      : cardData.captionHtml || '';

  return (
    <figure
      className={`vb-image-card${widthClass} relative group my-3.5`}
      onClick={() => {
        clearSelection();
        setSelected(true);
      }}
      style={{
        outline: isSelected ? '2px solid var(--vb-studio-primary, #6366f1)' : 'none',
        borderRadius: '12px',
        transition: 'outline 0.1s ease',
      }}
    >
      <StudioMediaFloatingToolbar
        onChange={requestMedia ? handleChangeFromLibrary : undefined}
        changeLabel="Change"
        changeTitle="Change image from library"
        onUnsplash={
          requestMedia && allowUnsplash !== false ? handleUnsplash : undefined
        }
        metadataLabel="Alt / Caption"
        metadataTitle="Edit alt text and caption"
        metadataContent={
          <ImageMetadataPopover
            alt={cardData.alt || ''}
            caption={captionStr}
            href={cardData.href || ''}
            onUpdate={handleMetadataUpdate}
            onClose={() => {}}
          />
        }
        width={
          typeof cardData.width === 'string'
            ? (cardData.width as 'regular' | 'wide' | 'full')
            : 'regular'
        }
        onWidthChange={handleWidthChange}
        onDelete={handleDelete}
        deleteTitle="Remove image"
        isSelected={isSelected}
      />

      <img
        src={cardData.src}
        alt={cardData.alt || ''}
        className="w-full rounded-xl overflow-hidden shadow-sm"
      />
      <NestedCaptionEditor
        initialCaptionJSON={
          typeof cardData.caption === 'object' && cardData.caption !== null
            ? (cardData.caption as Record<string, unknown>)
            : undefined
        }
        initialCaptionText={captionStr}
        captionHtml={
          typeof cardData.captionHtml === 'string'
            ? cardData.captionHtml
            : undefined
        }
        onChange={onCaptionChange}
        placeholder="Type caption for image (optional)"
      />
    </figure>
  );
}
