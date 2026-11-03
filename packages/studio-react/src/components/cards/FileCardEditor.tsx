import { useCallback, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { NodeKey, $getNodeByKey } from 'lexical';
import { FileCardData, StudioCardNode } from '@vibress/studio-cards';

import { NestedCaptionEditor } from './NestedCaptionEditor';
import { CardPlaceholder } from '../ui/CardPlaceholder';
import { useStudioUpload } from '../../upload-context';
import { File as FileIcon, Download } from 'lucide-react';

interface Props {
  nodeKey: NodeKey;
  cardData: FileCardData;
}

export function FileCardEditor({ nodeKey, cardData }: Props) {
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
      .then(() => uploadMedia(selectedFile, 'file'))
      .then(payload => {
        if (!payload || typeof payload.src !== 'string') {
          setUploadError(true);
          return;
        }
        editor.update(() => {
          const node = $getNodeByKey(nodeKey);
          if (node instanceof StudioCardNode) {
            // Use current node state, not closure data captured before upload.
            node.setCardData({ ...node.getCardData(), ...payload });
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
          <button type="button" className="mx-2 underline" disabled={uploading || !retryFile} onClick={() => { if (retryFile) attemptUpload(retryFile); }}>Retry</button>
          <button type="button" className="underline" onClick={() => setUploadError(false)}>Dismiss</button>
        </div>
      )}
      </div>
    );
  }

  return (
    <figure
      className={`vb-file-card relative my-3`}
      onClick={() => {
        clearSelection();
        setSelected(true);
      }}
      style={{
        outline: isSelected ? '2px solid #6366f1' : 'none',
        transition: 'outline 0.1s ease',
      }}
    >
      <div className="flex items-center gap-3.5 py-2.5 px-3.5 border border-border/80 dark:border-white/10 rounded-xl bg-card dark:bg-[#1a1c20]/90 backdrop-blur-md text-foreground shadow-sm">
        <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
          <FileIcon size={20} />
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="font-semibold text-sm truncate text-foreground">{cardData.fileName}</div>
          <div className="text-xs text-muted-foreground">{cardData.fileSize}</div>
        </div>
        <div className="p-2 bg-muted/60 dark:bg-white/[0.08] border border-border/60 dark:border-white/10 rounded-lg shadow-sm flex-shrink-0 text-muted-foreground">
          <Download size={16} />
        </div>
      </div>
      <NestedCaptionEditor
        initialCaptionJSON={typeof cardData.caption === 'object' ? cardData.caption : undefined}
        onChange={onCaptionChange}
        placeholder="Type caption for file (optional)"
      />
    </figure>
  );
}
