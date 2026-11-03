import { useCallback, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { NodeKey } from 'lexical';
import { ImageCardData, StudioCardNode } from '@vibress/studio-cards';

import { NestedCaptionEditor } from './NestedCaptionEditor';
import { $getNodeByKey } from 'lexical';
import { CardPlaceholder } from '../ui/CardPlaceholder';
import { useStudioUpload } from '../../upload-context';

interface Props {
  nodeKey: NodeKey;
  cardData: ImageCardData;
}

export function ImageCardEditor({ nodeKey, cardData }: Props) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const { uploadMedia } = useStudioUpload();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const [lastFile, setLastFile] = useState<File | null>(null);

  const isPopulated = !!cardData.src;

  const attemptUpload = (file: File) => {
    if (!uploadMedia || uploading) return;
    setLastFile(file);
    setUploadError(false);
    setUploading(true);
    uploadMedia(file, 'image')
      .then((payload) => {
        if (!payload) {
          setUploadError(true);
          return;
        }
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (node instanceof StudioCardNode) {
            node.setCardData({ ...node.getCardData(), ...payload });
          }
        });
      })
      .catch(() => setUploadError(true))
      .finally(() => setUploading(false));
  };

  const onFileSelect = (files: File[]) => {
    const file = files[0];
    if (file) attemptUpload(file);
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
            <button type="button" className="mx-2 underline" onClick={() => { if (lastFile) attemptUpload(lastFile); }} disabled={uploading}>Retry</button>
            <button type="button" className="underline" onClick={() => setUploadError(false)}>Dismiss</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <figure
      className={`vb-image-card${widthClass} relative my-3.5`}
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
      <img src={cardData.src} alt={cardData.alt || ''} className="w-full rounded-xl overflow-hidden shadow-sm" />
      <NestedCaptionEditor
        initialCaptionJSON={typeof cardData.caption === 'object' ? cardData.caption : undefined}
        onChange={onCaptionChange}
        placeholder="Type caption for image (optional)"
      />
    </figure>
  );
}
