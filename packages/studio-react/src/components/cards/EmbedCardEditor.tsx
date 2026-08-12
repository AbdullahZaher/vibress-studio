import { useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { NodeKey, $getNodeByKey } from 'lexical';
import { EmbedCardData, getEmbedProviderName } from '@vibress/studio-cards';
import { SafeHtml, sanitizeToSafeHtml } from '../../security/SafeHtml.js';
import { isSafeUrl } from '@vibress/studio-utils';
import { NestedCaptionEditor } from './NestedCaptionEditor.js';
import { assertCardSelection } from '../../utils/cardSelection.js';
import { UrlPlaceholder } from '../ui/UrlPlaceholder.js';

interface Props {
  nodeKey: NodeKey;
  cardData: EmbedCardData;
}

export function EmbedCardEditor({ nodeKey, cardData }: Props) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);

  const isPopulated = !!cardData.url;

  const onUrlSubmit = (url: string) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node && 'setCardData' in node) {
        (node as { setCardData(data: Record<string, unknown>): void }).setCardData({
          ...cardData,
          url,
        });
      }
    });
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
      <UrlPlaceholder
        iconType="embed"
        title="Embed"
        description="Paste a URL to embed content (e.g. YouTube, Vimeo)"
        onUrlSubmit={onUrlSubmit}
        validate={(u) => {
          try {
            return isSafeUrl(u) && new URL(u) !== null;
          } catch {
            return false;
          }
        }}
        isSelected={isSelected}
        onClick={() => assertCardSelection(clearSelection, setSelected)}
      />
    );
  }

  // Security: iframes are rendered only for provider-allowlisted URLs; raw
  // embed HTML is sanitized through the SafeHtml boundary (never raw).
  const provider = getEmbedProviderName(cardData.url);
  const safeEmbedHtml = cardData.html ? sanitizeToSafeHtml(cardData.html) : null;

  let src = cardData.url;
  if (src.includes('youtube.com/watch?v=')) {
    src = src.replace('youtube.com/watch?v=', 'youtube.com/embed/');
  }

  return (
    <figure
      className={`vb-embed-card relative w-full mb-4 flex flex-col gap-2`}
      onClick={() => assertCardSelection(clearSelection, setSelected)}
      style={{
        outline: isSelected ? '2px solid #3b82f6' : 'none',
        transition: 'outline 0.1s ease',
      }}
    >
      <div className="relative w-full overflow-hidden bg-gray-100 rounded-md" style={{ paddingTop: '56.25%' /* 16:9 Aspect Ratio */ }}>
        {safeEmbedHtml ? (
          <SafeHtml html={safeEmbedHtml} className="absolute top-0 left-0 w-full h-full" />
        ) : provider ? (
          <iframe
            className="absolute top-0 left-0 w-full h-full"
            src={src}
            frameBorder="0"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Embedded content"
            referrerPolicy="no-referrer"
          />
        ) : (
          <a
            className="absolute inset-0 flex items-center justify-center text-sm text-gray-500 underline"
            href={src}
            target="_blank"
            rel="noopener noreferrer"
          >
            {src}
          </a>
        )}
      </div>
      <NestedCaptionEditor
        initialCaptionJSON={typeof cardData.caption === 'object' ? cardData.caption : undefined}
        onChange={onCaptionChange}
        placeholder="Type caption for embed (optional)"
      />
    </figure>
  );
}
