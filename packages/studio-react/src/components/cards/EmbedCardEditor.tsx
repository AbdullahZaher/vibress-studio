import { useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { NodeKey, $getNodeByKey } from 'lexical';
import { EmbedCardData, StudioCardNode } from '@vibress/studio-cards';
import { resolveStudioEmbedDestination } from './embed-destination';

import { NestedCaptionEditor } from './NestedCaptionEditor';
import { captionMetadataPatch } from './caption-metadata';
import { UrlPlaceholder } from '../ui/UrlPlaceholder';
import { StudioMediaFloatingToolbar } from '../ui/StudioMediaFloatingToolbar';
import { EmbedMetadataPopover } from '../ui/media-popovers/EmbedMetadataPopover';

interface Props {
  nodeKey: NodeKey;
  cardData: EmbedCardData;
}

export function EmbedCardEditor({ nodeKey, cardData }: Props) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);

  const isPopulated = !!cardData.url || !!cardData.html;

  const onUrlSubmit = (url: string) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node instanceof StudioCardNode) {
        node.setCardData({
          ...cardData,
          url,
        });
      }
    });
  };

  const handleMetadataUpdate = useCallback(
    (data: { url: string; caption: string }) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node instanceof StudioCardNode && node.isAttached()) {
          const currentData = node.getCardData();
          node.setCardData({
            ...currentData,
            url: data.url,
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
          const currentData = node.getCardData();
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
      if (node) {
        node.remove();
      }
    });
  }, [editor, nodeKey]);

  const onCaptionChange = useCallback(
    (captionJSON: Record<string, unknown>, captionHtml: string) => {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node instanceof StudioCardNode && node.isAttached()) {
          const currentData = node.getCardData();
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

  const extendedData = cardData as EmbedCardData & { width?: 'regular' | 'wide' | 'full'; captionHtml?: string };
  const widthClass =
    typeof extendedData.width === 'string' && extendedData.width !== 'regular'
      ? ` vb-width-${extendedData.width}`
      : '';

  if (!isPopulated) {
    return (
      <UrlPlaceholder
        iconType="embed"
        title="Embed"
        description="Paste a URL to embed content (e.g. YouTube, Vimeo)"
        onUrlSubmit={onUrlSubmit}
        isSelected={isSelected}
        onClick={() => {
          clearSelection();
          setSelected(true);
        }}
      />
    );
  }

  const embedDestination = resolveStudioEmbedDestination(cardData.url);
  const hasLegacyHtml = typeof cardData.html === 'string' && cardData.html.trim().length > 0;

  const captionStr =
    typeof extendedData.caption === 'string'
      ? extendedData.caption
      : extendedData.captionHtml || '';

  return (
    <figure
      className={`vb-embed-card${widthClass} relative group w-full mb-4 flex flex-col gap-2`}
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
        metadataLabel="Options"
        metadataTitle="Edit embed URL and caption"
        metadataContent={
          <EmbedMetadataPopover
            url={cardData.url || ''}
            caption={captionStr}
            onUpdate={handleMetadataUpdate}
            onClose={() => {}}
          />
        }
        width={
          typeof extendedData.width === 'string'
            ? extendedData.width
            : 'regular'
        }
        onWidthChange={handleWidthChange}
        onDelete={handleDelete}
        deleteTitle="Remove embed"
        isSelected={isSelected}
      />

      <div
        className="relative w-full overflow-hidden bg-muted/60 dark:bg-white/[0.04] rounded-xl border border-border/80 dark:border-white/10 shadow-sm"
        style={{ paddingTop: '56.25%' /* 16:9 Aspect Ratio */ }}
      >
        {embedDestination.kind === 'iframe' ? (
          <iframe
            className="absolute top-0 left-0 w-full h-full"
            src={embedDestination.url}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Embedded content"
          />
        ) : embedDestination.kind === 'external-link' ? (
          <div className="absolute inset-0 flex items-center justify-center p-4 text-center">
            <a
              href={embedDestination.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm underline text-foreground"
            >
              Open external content
            </a>
          </div>
        ) : (
          <div role="status" className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
            Unsupported or unsafe embed URL.
          </div>
        )}
      </div>

      {hasLegacyHtml && (
        <p className="text-xs text-amber-700 dark:text-amber-300" role="note">
          Legacy embed HTML is not published. Only approved URL embeds or safe links appear in the published article.
        </p>
      )}
      <NestedCaptionEditor
        initialCaptionJSON={
          typeof cardData.caption === 'object' && cardData.caption !== null
            ? (cardData.caption as Record<string, unknown>)
            : undefined
        }
        initialCaptionText={captionStr}
        captionHtml={
          typeof extendedData.captionHtml === 'string'
            ? extendedData.captionHtml
            : undefined
        }
        onChange={onCaptionChange}
        placeholder="Type caption for embed (optional)"
      />
    </figure>
  );
}
