import { useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { NodeKey, $getNodeByKey } from 'lexical';
import { FileCardData } from '@vibress/studio-cards';
import { NestedCaptionEditor } from './NestedCaptionEditor.js';
import { CardPlaceholder } from '../ui/CardPlaceholder.js';
import { UploadStatusOverlay } from '../ui/UploadStatusOverlay.js';
import { File as FileIcon, Download } from 'lucide-react';

import { useStudioUploadAdapter } from '../../media/UploadAdapterContext.js';
import { assertCardSelection } from '../../utils/cardSelection.js';
import { createObjectUrl } from '../../media/object-url.js';
import { useMediaUpload } from '../../media/useMediaUpload.js';

interface Props {
  nodeKey: NodeKey;
  cardData: FileCardData;
}

export function FileCardEditor({ nodeKey, cardData }: Props) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const adapter = useStudioUploadAdapter();

  const { status, progress, error, asset, previewUrl, upload, retry, clear } = useMediaUpload({
    adapter,
    cardType: 'file',
    onSuccess: (uploaded) => {
      const fileSize = (uploaded.size / (1024 * 1024)).toFixed(2) + ' MB';
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node && 'setCardData' in node) {
          (node as { setCardData(data: Record<string, unknown>): void }).setCardData({
            ...cardData,
            src: uploaded.url,
            assetId: uploaded.id,
            fileName: uploaded.alt || cardData.fileName || '',
            fileSize,
          });
        }
      });
    },
  });

  const isPopulated = !!cardData.src || !!previewUrl;

  const onFileSelect = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (!adapter) {
      const url = createObjectUrl(file);
      const fileSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node && 'setCardData' in node) {
          (node as { setCardData(data: Record<string, unknown>): void }).setCardData({
            ...cardData,
            src: url,
            fileName: file.name,
            fileSize,
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

  if (!isPopulated) {
    return (
      <CardPlaceholder
        iconType="file"
        title="File"
        description="Click to select a file to attach"
        onFileSelect={onFileSelect}
        isSelected={isSelected}
        onClick={() => assertCardSelection(clearSelection, setSelected)}
      />
    );
  }

  const displaySrc = previewUrl || asset?.url || cardData.src;

  return (
    <div
      className="vb-file-card relative w-full mb-4"
      onClick={() => assertCardSelection(clearSelection, setSelected)}
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
      <a
        href={displaySrc}
        download
        className="flex items-center gap-3 p-4 border rounded-md bg-white hover:bg-gray-50 no-underline text-current shadow-sm"
      >
        <FileIcon className="w-8 h-8 text-gray-400" strokeWidth={1.5} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium truncate">{cardData.fileName || 'Untitled file'}</div>
          {cardData.fileSize && <div className="text-xs text-gray-500">{cardData.fileSize}</div>}
        </div>
        <Download className="w-4 h-4 text-gray-400" />
      </a>
      <NestedCaptionEditor
        initialCaptionJSON={typeof cardData.caption === 'object' ? cardData.caption : undefined}
        onChange={onCaptionChange}
        placeholder="Type caption for file (optional)"
      />
    </div>
  );
}
