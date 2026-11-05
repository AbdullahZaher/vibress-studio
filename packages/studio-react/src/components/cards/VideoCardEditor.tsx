import { useCallback, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { NodeKey, $getNodeByKey } from 'lexical';
import { VideoCardData, StudioCardNode } from '@vibress/studio-cards';

import { NestedCaptionEditor } from './NestedCaptionEditor';
import { captionMetadataPatch } from './caption-metadata';
import { CardPlaceholder } from '../ui/CardPlaceholder';
import { useStudioMedia } from '../../media-context';
import { isDurableMediaUrl, mergeDurableMediaAsset } from '../../utils/mergeDurableMedia';
import { MediaPickerError } from '../ui/MediaPickerError';
import { useCardMediaPicker } from '../../utils/useCardMediaPicker';
import { useMediaRequestGuard } from '../../utils/useMediaRequestGuard';
import { StudioMediaFloatingToolbar } from '../ui/StudioMediaFloatingToolbar';
import { VideoMetadataPopover } from '../ui/media-popovers/VideoMetadataPopover';

interface Props {
  nodeKey: NodeKey;
  cardData: VideoCardData;
}

export function VideoCardEditor({ nodeKey, cardData }: Props) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);
  const { uploadMedia, requestMedia } = useStudioMedia();
  const { uploading, beginRequest } = useMediaRequestGuard();
  const [uploadError, setUploadError] = useState(false);
  const [retryFile, setRetryFile] = useState<File | null>(null);

  const isPopulated = !!cardData.src;

  const attemptUpload = (selectedFile: File) => {
    if (!uploadMedia || uploading || !editor.isEditable()) return;
    const isCurrent = beginRequest(true, true);
    picker.dismiss();
    setRetryFile(selectedFile);
    setUploadError(false);
    Promise.resolve()
      .then(() => isCurrent() ? uploadMedia(selectedFile, 'video') : null)
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
            const next = mergeDurableMediaAsset(node.getCardData(), payload, 'video', selectedFile.name);
            if (next) node.setCardData(next);
          }
        });
      })
      .catch(() => { if (isCurrent()) setUploadError(true); })
      .finally(isCurrent.finish);
  };

  const onFileSelect = (files: File[]) => {
    if (files[0]) attemptUpload(files[0]);
  };

  const picker = useCardMediaPicker(editor, nodeKey, 'video', beginRequest, requestMedia,
    useCallback(() => setUploadError(false), []));
  const handleChangeFromLibrary = useCallback(() => picker.pick('library'), [picker.pick]);
  const pickerFailure = picker.failedSource !== null ? <MediaPickerError
    onRetry={() => { void picker.pick(picker.failedSource!); }} onDismiss={picker.dismiss} /> : null;

  const handleMetadataUpdate = useCallback(
    (data: {
      caption: string;
      poster?: string | undefined;
      loop?: boolean | undefined;
      autoplay?: boolean | undefined;
    }) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node instanceof StudioCardNode && node.isAttached()) {
          node.setCardData({
            ...node.getCardData(),
            ...captionMetadataPatch(node.getCardData(), data.caption),
            poster: data.poster,
            loop: data.loop,
            autoplay: data.autoplay,
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
          node.setCardData({
            ...node.getCardData(),
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

  const widthClass =
    typeof cardData.width === 'string' && cardData.width !== 'regular'
      ? ` vb-width-${cardData.width}`
      : '';

  if (!isPopulated) {
    return (
      <div>
        {pickerFailure}
        <CardPlaceholder
          iconType="video"
          title="Video"
          description="Click to select a video, or drag and drop"
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
      : cardData.captionHtml || '';

  return (
    <figure
      className={`vb-video-card${widthClass} relative group my-3.5`}
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
      {pickerFailure}
      <StudioMediaFloatingToolbar
        onChange={requestMedia ? handleChangeFromLibrary : undefined}
        changeLabel="Change"
        changeTitle="Change video from library"
        metadataLabel="Options"
        metadataTitle="Edit video settings and caption"
        metadataContent={
          <VideoMetadataPopover
            caption={captionStr}
            poster={cardData.poster}
            loop={cardData.loop}
            autoplay={cardData.autoplay}
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
        deleteTitle="Remove video"
        isSelected={isSelected}
      />

      <video
        src={cardData.src}
        controls
        poster={cardData.poster}
        loop={cardData.loop}
        autoPlay={cardData.autoplay}
        className="w-full rounded-xl overflow-hidden shadow-sm bg-black"
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
        placeholder="Type caption for video (optional)"
      />
    </figure>
  );
}
