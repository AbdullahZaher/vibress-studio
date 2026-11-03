import { useCallback, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { NodeKey, $getNodeByKey } from 'lexical';
import { AudioCardData, StudioCardNode } from '@vibress/studio-cards';

import { NestedCaptionEditor } from './NestedCaptionEditor';
import { CardPlaceholder } from '../ui/CardPlaceholder';
import { useStudioUpload } from '../../upload-context';

interface Props {
  nodeKey: NodeKey;
  cardData: AudioCardData;
}

export function AudioCardEditor({ nodeKey, cardData }: Props) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const { uploadMedia } = useStudioUpload();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(false);
  const [retryFile, setRetryFile] = useState<File | null>(null);

  const isPopulated = !!cardData.src;

  const attemptUpload = (selectedFile: File) => {
    if (!uploadMedia || uploading) return;
    setRetryFile(selectedFile);
    setUploadError(false);
    setUploading(true);
    Promise.resolve()
      .then(() => uploadMedia(selectedFile, 'audio'))
      .then(payload => {
        if (!payload || typeof payload.src !== 'string') {
          setUploadError(true);
          return;
        }
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (node instanceof StudioCardNode) {
            // Use current node state, not closure data captured before upload.
            node.setCardData({ ...node.getCardData(), ...payload, title: selectedFile.name });
          }
        });
      })
      .catch(() => setUploadError(true))
      .finally(() => setUploading(false));
  };

  const onFileSelect = (files: File[]) => {
    if (files[0]) attemptUpload(files[0]);
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

  if (!isPopulated) {
    return (
      <div>
      <CardPlaceholder
        iconType="audio"
        title="Audio"
        description="Click to select an audio file, or drag and drop"
        onFileSelect={onFileSelect}
        uploading={uploading}
        isSelected={isSelected}
        onClick={() => {
          clearSelection();
          setSelected(true);
        }}
      />
      {uploadError && (
        <div role="alert" className="my-2 text-sm text-red-700">
          Upload failed.
          <button type="button" className="mx-2 underline" disabled={uploading || !retryFile} onClick={() => { if (retryFile) attemptUpload(retryFile); }}>Retry</button>
          <button type="button" className="underline" onClick={() => setUploadError(false)}>Dismiss</button>
        </div>
      )}
      </div>
    );
  }

  return (
    <figure
      className={`vb-audio-card relative flex flex-col gap-2 p-4 my-3.5 border border-border/80 dark:border-white/10 rounded-xl bg-card dark:bg-[#1a1c20]/90 backdrop-blur-md shadow-sm`}
      onClick={() => {
        clearSelection();
        setSelected(true);
      }}
      style={{
        outline: isSelected ? '2px solid #6366f1' : 'none',
        transition: 'outline 0.1s ease',
      }}
    >
      {cardData.title && <div className="text-sm font-semibold">{cardData.title}</div>}
      <audio src={cardData.src} controls className="w-full" />
      <NestedCaptionEditor
        initialCaptionJSON={typeof cardData.caption === 'object' ? cardData.caption : undefined}
        onChange={onCaptionChange}
        placeholder="Type caption for audio (optional)"
      />
    </figure>
  );
}
