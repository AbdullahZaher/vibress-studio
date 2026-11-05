import { useCallback, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { NodeKey, $getNodeByKey } from 'lexical';
import { AudioCardData, StudioCardNode } from '@vibress/studio-cards';

import { NestedCaptionEditor } from './NestedCaptionEditor';
import { captionMetadataPatch } from './caption-metadata';
import { CardPlaceholder } from '../ui/CardPlaceholder';
import { useStudioMedia } from '../../media-context';
import { StudioMediaFloatingToolbar } from '../ui/StudioMediaFloatingToolbar';
import { AudioMetadataPopover } from '../ui/media-popovers/AudioMetadataPopover';

interface Props {
  nodeKey: NodeKey;
  cardData: AudioCardData;
}

export function AudioCardEditor({ nodeKey, cardData }: Props) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const { uploadMedia, requestMedia } = useStudioMedia();
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
      .then((payload) => {
        if (!payload || typeof payload.src !== 'string') {
          setUploadError(true);
          return;
        }
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (node instanceof StudioCardNode && node.isAttached()) {
            node.setCardData({
              ...node.getCardData(),
              ...payload,
              title: selectedFile.name,
            });
          }
        });
      })
      .catch(() => setUploadError(true))
      .finally(() => setUploading(false));
  };

  const onFileSelect = (files: File[]) => {
    if (files[0]) attemptUpload(files[0]);
  };

  const handleChangeFromLibrary = useCallback(async () => {
    if (!requestMedia) return;
    const payload = await requestMedia({
      cardType: 'audio',
      source: 'library',
    });
    if (!payload) return;
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node instanceof StudioCardNode && node.isAttached()) {
        node.setCardData({
          ...node.getCardData(),
          ...payload,
        });
      }
    });
  }, [editor, nodeKey, requestMedia]);

  const handleMetadataUpdate = useCallback(
    (data: { title: string; caption: string }) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node instanceof StudioCardNode && node.isAttached()) {
          node.setCardData({
            ...node.getCardData(),
            title: data.title,
            ...captionMetadataPatch(node.getCardData(), data.caption),
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
            <button
              type="button"
              className="mx-2 underline"
              disabled={uploading || !retryFile}
              onClick={() => {
                if (retryFile) attemptUpload(retryFile);
              }}
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
      : (cardData as { captionHtml?: string }).captionHtml || '';

  return (
    <figure
      className={`vb-audio-card relative group flex flex-col gap-2 p-4 my-3.5 border border-border/80 dark:border-white/10 rounded-xl bg-card dark:bg-[#1a1c20]/90 backdrop-blur-md shadow-sm`}
      onClick={() => {
        clearSelection();
        setSelected(true);
      }}
      style={{
        outline: isSelected ? '2px solid var(--vb-studio-primary, #6366f1)' : 'none',
        transition: 'outline 0.1s ease',
      }}
    >
      <StudioMediaFloatingToolbar
        onChange={requestMedia ? handleChangeFromLibrary : undefined}
        changeLabel="Change"
        changeTitle="Change audio from library"
        metadataLabel="Details"
        metadataTitle="Edit title and caption"
        metadataContent={
          <AudioMetadataPopover
            title={cardData.title || ''}
            caption={captionStr}
            onUpdate={handleMetadataUpdate}
            onClose={() => {}}
          />
        }
        onDelete={handleDelete}
        deleteTitle="Remove audio"
        isSelected={isSelected}
      />

      {cardData.title && <div className="text-sm font-semibold">{cardData.title}</div>}
      <audio src={cardData.src} controls className="w-full" />
      <NestedCaptionEditor
        initialCaptionJSON={
          typeof cardData.caption === 'object' && cardData.caption !== null
            ? (cardData.caption as Record<string, unknown>)
            : undefined
        }
        initialCaptionText={captionStr}
        captionHtml={
          typeof (cardData as { captionHtml?: string }).captionHtml === 'string'
            ? (cardData as { captionHtml?: string }).captionHtml
            : undefined
        }
        onChange={onCaptionChange}
        placeholder="Type caption for audio (optional)"
      />
    </figure>
  );
}
