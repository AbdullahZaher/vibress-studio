import { useCallback, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { NodeKey } from 'lexical';
import { GalleryCardData, StudioCardNode } from '@vibress/studio-cards';

import { NestedCaptionEditor } from './NestedCaptionEditor';
import { $getNodeByKey } from 'lexical';
import { CardPlaceholder } from '../ui/CardPlaceholder';
import { useStudioUpload } from '../../upload-context';

interface Props {
  nodeKey: NodeKey;
  cardData: GalleryCardData;
}

export function GalleryCardEditor({ nodeKey, cardData }: Props) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const { uploadMedia } = useStudioUpload();
  const [uploading, setUploading] = useState(false);
  const [failedFiles, setFailedFiles] = useState<File[]>([]);

  const isPopulated = cardData.images && cardData.images.length > 0;

  const onFileSelect = (files: File[]) => {
    if (files.length === 0 || !uploadMedia || uploading) return;
    setFailedFiles([]);
    setUploading(true);
    Promise.all(files.map(async selectedFile => {
      try {
        return { selectedFile, payload: await uploadMedia(selectedFile, 'gallery') };
      } catch {
        return { selectedFile, payload: null };
      }
    }))
      .then(results => {
        const newImages = results
          .map(result => result.payload)
          .filter((payload): payload is Record<string, unknown> =>
            payload != null && typeof payload.src === 'string')
          .map(payload => ({
            src: payload.src as string,
            alt: typeof payload.alt === 'string' ? payload.alt : '',
            assetId: typeof payload.assetId === 'string' ? payload.assetId : undefined,
          }));
        setFailedFiles(results.filter(result =>
          !result.payload || typeof result.payload.src !== 'string')
          .map(result => result.selectedFile));
        if (newImages.length === 0) return;
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (node instanceof StudioCardNode) {
            const currentData = node.getCardData();
            const currentImages = Array.isArray(currentData.images) ? currentData.images : [];
            node.setCardData({
              ...currentData,
              images: [...currentImages, ...newImages],
            });
          }
        });
      })
      .catch(() => setFailedFiles(files))
      .finally(() => setUploading(false));
  };

  const onCaptionChange = useCallback(
    (captionJSON: Record<string, unknown>, captionHtml: string) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node instanceof StudioCardNode) {
          node.setCardData({
            ...node.getCardData(),
            caption: captionJSON,
            captionHtml,
          });
        }
      });
    },
    [editor, nodeKey]
  );

  const widthClass = cardData.width && cardData.width !== 'regular' ? ` vb-width-${cardData.width}` : '';

  const uploadFailure = failedFiles.length > 0 ? (
    <div role="alert" className="my-2 text-sm text-red-700">
      Upload failed for {failedFiles.length} image(s).
      <button type="button" className="mx-2 underline" disabled={uploading} onClick={() => onFileSelect(failedFiles)}>Retry</button>
      <button type="button" className="underline" onClick={() => setFailedFiles([])}>Dismiss</button>
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
      </div>
    );
  }

  return (
    <>
    <figure
      className={`vb-gallery-card${widthClass} relative my-3.5`}
      onClick={() => {
        clearSelection();
        setSelected(true);
      }}
      style={{
        outline: isSelected ? '2px solid #6366f1' : 'none',
        borderRadius: '12px',
        transition: 'outline 0.1s ease',
      }}
    >
      <div className="flex flex-wrap gap-2.5">
        {cardData.images.map((img, i) => (
          <img key={i} src={img.src} alt={img.alt || ''} className="flex-1 object-cover min-w-[200px] rounded-xl shadow-sm" style={{ maxHeight: '300px' }} />
        ))}
      </div>
      <NestedCaptionEditor
        initialCaptionJSON={typeof cardData.caption === 'object' ? cardData.caption : undefined}
        onChange={onCaptionChange}
        placeholder="Type caption for gallery (optional)"
      />
    </figure>
    {uploadFailure}
    </>
  );
}
