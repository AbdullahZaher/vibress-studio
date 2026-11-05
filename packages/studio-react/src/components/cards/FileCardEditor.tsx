import { useCallback, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { NodeKey, $getNodeByKey } from 'lexical';
import { FileCardData, StudioCardNode } from '@vibress/studio-cards';

import { NestedCaptionEditor } from './NestedCaptionEditor';
import { captionMetadataPatch } from './caption-metadata';
import { CardPlaceholder } from '../ui/CardPlaceholder';
import { useStudioMedia } from '../../media-context';
import { isDurableMediaUrl, mergeDurableMediaAsset } from '../../utils/mergeDurableMedia';
import { StudioMediaFloatingToolbar } from '../ui/StudioMediaFloatingToolbar';
import { FileMetadataPopover } from '../ui/media-popovers/FileMetadataPopover';
import { File as FileIcon, Download } from 'lucide-react';

interface Props {
  nodeKey: NodeKey;
  cardData: FileCardData;
}

export function FileCardEditor({ nodeKey, cardData }: Props) {
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
      .then(() => uploadMedia(selectedFile, 'file'))
      .then((payload) => {
        if (!payload || !isDurableMediaUrl(payload.src)) {
          setUploadError(true);
          return;
        }
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (node instanceof StudioCardNode && node.isAttached()) {
            const next = mergeDurableMediaAsset(node.getCardData(), payload, 'file', selectedFile.name);
            if (next) node.setCardData(next);
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
      cardType: 'file',
      source: 'library',
    });
    if (!payload || !isDurableMediaUrl(payload.src)) return;
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node instanceof StudioCardNode && node.isAttached()) {
        const next = mergeDurableMediaAsset(node.getCardData(), payload, 'file');
        if (next) node.setCardData(next);
      }
    });
  }, [editor, nodeKey, requestMedia]);

  const handleMetadataUpdate = useCallback(
    (data: { fileName: string; caption: string }) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node instanceof StudioCardNode && node.isAttached()) {
          node.setCardData({
            ...node.getCardData(),
            fileName: data.fileName,
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
          iconType="file"
          title="File"
          description="Click to select a file, or drag and drop"
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
      className={`vb-file-card relative group my-3`}
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
        changeTitle="Change file from library"
        metadataLabel="Details"
        metadataTitle="Edit file details and caption"
        metadataContent={
          <FileMetadataPopover
            fileName={cardData.fileName || ''}
            caption={captionStr}
            onUpdate={handleMetadataUpdate}
            onClose={() => {}}
          />
        }
        onDelete={handleDelete}
        deleteTitle="Remove file"
        isSelected={isSelected}
      />

      <div className="flex items-center gap-3.5 py-2.5 px-3.5 border border-border/80 dark:border-white/10 rounded-xl bg-card dark:bg-[#1a1c20]/90 backdrop-blur-md text-foreground shadow-sm">
        <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
          <FileIcon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{cardData.fileName || 'Download File'}</div>
          {cardData.fileSize && (
            <div className="text-xs text-muted-foreground">
              {isNaN(Number(cardData.fileSize))
                ? cardData.fileSize
                : `${(Number(cardData.fileSize) / 1024 / 1024).toFixed(2)} MB`}
            </div>
          )}
        </div>
        {cardData.src && (
          <a
            href={cardData.src}
            download={cardData.fileName || true}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Download file"
            onClick={(e) => e.stopPropagation()}
          >
            <Download size={18} />
          </a>
        )}
      </div>
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
        placeholder="Type caption for file (optional)"
      />
    </figure>
  );
}
