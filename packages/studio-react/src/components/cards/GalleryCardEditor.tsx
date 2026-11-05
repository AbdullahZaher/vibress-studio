import { useCallback, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { NodeKey, $getNodeByKey } from 'lexical';
import { GalleryCardData, StudioCardNode } from '@vibress/studio-cards';

import { NestedCaptionEditor } from './NestedCaptionEditor';
import { captionMetadataPatch } from './caption-metadata';
import { CardPlaceholder } from '../ui/CardPlaceholder';
import { useStudioMedia } from '../../media-context';
import { isDurableMediaUrl } from '../../utils/mergeDurableMedia';
import { StudioMediaFloatingToolbar } from '../ui/StudioMediaFloatingToolbar';
import { GalleryMetadataPopover } from '../ui/media-popovers/GalleryMetadataPopover';

interface Props {
  nodeKey: NodeKey;
  cardData: GalleryCardData;
}

/** Identity is a non-empty durable asset ID, otherwise the durable URL.
 * Existing gallery items are never filtered or rewritten by an additive action.
 */
function appendGalleryImages(
  existing: unknown[],
  additions: Array<{ src: string; alt: string; assetId?: string | undefined }>
): unknown[] {
  const identity = (item: unknown): string | null => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
    const entry = item as Record<string, unknown>;
    if (typeof entry.assetId === 'string' && entry.assetId.trim()) return `asset:${entry.assetId.trim()}`;
    return typeof entry.src === 'string' && entry.src.trim() ? `url:${entry.src.trim()}` : null;
  };
  const seen = new Set(existing.map(identity).filter((id): id is string => id !== null));
  const merged = [...existing];
  for (const image of additions) {
    const id = identity(image);
    if (!id || seen.has(id)) continue;
    merged.push(image);
    seen.add(id);
  }
  return merged;
}

export function GalleryCardEditor({ nodeKey, cardData }: Props) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const { uploadMedia, requestMedia } = useStudioMedia();
  const [uploading, setUploading] = useState(false);
  const [failedFiles, setFailedFiles] = useState<File[]>([]);
  const [pickerError, setPickerError] = useState(false);

  const isPopulated = cardData.images && cardData.images.length > 0;

  const onFileSelect = (files: File[]) => {
    if (files.length === 0 || !uploadMedia || uploading) return;
    setFailedFiles([]);
    setUploading(true);
    Promise.all(
      files.map(async (selectedFile) => {
        try {
          return { selectedFile, payload: await uploadMedia(selectedFile, 'gallery') };
        } catch {
          return { selectedFile, payload: null };
        }
      })
    )
      .then((results) => {
        const newImages = results
          .map((result) => result.payload)
          .filter(
            (payload): payload is Record<string, unknown> =>
              payload != null && isDurableMediaUrl(payload.src)
          )
          .map((payload) => ({
            src: payload.src as string,
            alt: typeof payload.alt === 'string' ? payload.alt : '',
            assetId: typeof payload.assetId === 'string' ? payload.assetId : undefined,
          }));
        setFailedFiles(
          results
            .filter((result) => !result.payload || !isDurableMediaUrl(result.payload.src))
            .map((result) => result.selectedFile)
        );
        if (newImages.length === 0) return;
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (node instanceof StudioCardNode && node.isAttached()) {
            const currentData = node.getCardData();
            const currentImages = Array.isArray(currentData.images) ? currentData.images : [];
            const mergedImages = appendGalleryImages(currentImages, newImages);
            if (mergedImages.length !== currentImages.length) {
              node.setCardData({ ...currentData, images: mergedImages });
            }
          }
        });
      })
      .catch(() => setFailedFiles(files))
      .finally(() => setUploading(false));
  };

  const handleChangeFromLibrary = useCallback(async () => {
    if (!requestMedia) return;
    setPickerError(false);
    try {
      const payload = await requestMedia({ cardType: 'gallery', source: 'library' });
      if (!payload) return; // Cancellation must be a no-op.
      const requested = Array.isArray(payload.images)
        ? payload.images
        : isDurableMediaUrl(payload.src) ? [payload] : [];
      const images = requested.flatMap((item: unknown) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
        const record = item as Record<string, unknown>;
        if (!isDurableMediaUrl(record.src)) return [];
        if (record.assetId != null && (typeof record.assetId !== 'string' || !record.assetId.trim())) return [];
        return [{
          src: record.src.trim(),
          alt: typeof record.alt === 'string' ? record.alt : '',
          assetId: typeof record.assetId === 'string' ? record.assetId.trim() : undefined,
        }];
      });
      if (!images.length) return;
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (!(node instanceof StudioCardNode) || !node.isAttached()) return;
        // The author's latest node state owns existing images and metadata,
        // even if the picker resolved after unrelated edits.
        const currentData = node.getCardData();
        const existing = Array.isArray(currentData.images) ? currentData.images : [];
        const merged = appendGalleryImages(existing, images);
        if (merged.length !== existing.length) {
          node.setCardData({ ...currentData, images: merged });
        }
      });
    } catch {
      setPickerError(true);
    }
  }, [editor, nodeKey, requestMedia]);

  const handleMetadataUpdate = useCallback(
    (data: { caption: string }) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node instanceof StudioCardNode && node.isAttached()) {
          const currentData = (node.getCardData() || {}) as GalleryCardData;
          node.setCardData({
            ...currentData,
            ...captionMetadataPatch(node.getCardData(), data.caption),
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
          const currentData = (node.getCardData() || {}) as GalleryCardData;
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
          const currentData = (node.getCardData() || {}) as GalleryCardData;
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

  const uploadFailure =
    failedFiles.length > 0 ? (
      <div role="alert" className="my-2 text-sm text-red-700">
        Upload failed for {failedFiles.length} image(s).
        <button
          type="button"
          className="mx-2 underline"
          disabled={uploading}
          onClick={() => onFileSelect(failedFiles)}
        >
          Retry
        </button>
        <button type="button" className="underline" onClick={() => setFailedFiles([])}>
          Dismiss
        </button>
      </div>
    ) : null;

  if (!isPopulated) {
    return (
      <div>
        <CardPlaceholder
          iconType="gallery"
          title="Gallery"
          description="Click to select images, or drag and drop"
          onFileSelect={onFileSelect}
          multiple={true}
          uploading={uploading}
          isSelected={isSelected}
          onClick={() => {
            clearSelection();
            setSelected(true);
          }}
        />
        {uploadFailure}
        {pickerError && (
          <div role="alert">Could not open the media library. Existing images were preserved.
            <button type="button" onClick={() => setPickerError(false)}>Dismiss</button>
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
    <>
      <figure
        className={`vb-gallery-card${widthClass} relative group my-3.5`}
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
          changeLabel="Add Images"
          changeTitle="Add images from library"
          metadataLabel="Caption"
          metadataTitle="Edit gallery caption"
          metadataContent={
            <GalleryMetadataPopover
              caption={captionStr}
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
          deleteTitle="Remove gallery"
          isSelected={isSelected}
        />

        <div className="flex flex-wrap gap-2.5">
          {cardData.images.map((img, i) => (
            <img
              key={i}
              src={img.src}
              alt={img.alt || ''}
              className="flex-1 object-cover min-w-[200px] rounded-xl shadow-sm"
              style={{ maxHeight: '300px' }}
            />
          ))}
        </div>
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
          placeholder="Type caption for gallery (optional)"
        />
      </figure>
      {uploadFailure}
      {pickerError && (
        <div role="alert">Could not open the media library. Existing images were preserved.
          <button type="button" onClick={() => setPickerError(false)}>Dismiss</button>
        </div>
      )}
    </>
  );
}
