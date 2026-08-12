import { useMemo, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { NodeKey, $getNodeByKey } from 'lexical';
import { BookmarkCardData } from '@vibress/studio-cards';
import { isSafeUrl } from '@vibress/studio-utils';
import { UrlPlaceholder } from '../ui/UrlPlaceholder.js';
import { assertCardSelection } from '../../utils/cardSelection.js';

interface Props {
  nodeKey: NodeKey;
  cardData: BookmarkCardData;
}

/** Parse a URL without crashing; returns null for malformed input. */
function parseUrlSafely(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

export function BookmarkCardEditor({ nodeKey, cardData }: Props) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);

  const isPopulated = !!cardData.url;

  // Never let malformed stored data crash the editor: derive a display
  // hostname safely, falling back to the raw URL string.
  const { hostname, validUrl } = useMemo(() => {
    const parsed = parseUrlSafely(cardData.url);
    if (parsed) {
      return { hostname: parsed.hostname, validUrl: cardData.url };
    }
    return { hostname: cardData.url, validUrl: '' };
  }, [cardData.url]);

  const onUrlSubmit = (url: string) => {
    // Malformed URLs are rejected with a validation state instead of
    // crashing or silently persisting bad data.
    if (!isSafeUrl(url)) return;

    const parsed = parseUrlSafely(url);
    if (!parsed) return;

    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node && 'setCardData' in node) {
        (node as { setCardData(data: Record<string, unknown>): void }).setCardData({
          ...cardData,
          url,
          title: parsed.hostname,
          description: 'A bookmark link',
        });
      }
    });
  };

  if (!isPopulated) {
    return (
      <UrlPlaceholder
        iconType="bookmark"
        title="Bookmark"
        description="Paste a URL to add a bookmark"
        onUrlSubmit={onUrlSubmit}
        validate={(u) => isSafeUrl(u) && parseUrlSafely(u) !== null}
        isSelected={isSelected}
        onClick={() => assertCardSelection(clearSelection, setSelected)}
      />
    );
  }

  return (
    <figure
      className={`vb-bookmark-card relative w-full mb-4`}
      onClick={() => assertCardSelection(clearSelection, setSelected)}
      style={{
        outline: isSelected ? '2px solid #3b82f6' : 'none',
        transition: 'outline 0.1s ease',
      }}
    >
      <a
        href={validUrl || cardData.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex border rounded-md overflow-hidden hover:bg-gray-50 bg-white no-underline text-current shadow-sm"
        style={{ height: '140px' }}
      >
        <div className="flex flex-col flex-1 p-4 justify-between min-w-0">
          <div>
            <div className="font-semibold truncate mb-1 text-sm">{cardData.title || cardData.url}</div>
            <div className="text-sm text-gray-500 line-clamp-2">{cardData.description}</div>
          </div>
          <div className="flex items-center mt-2 text-xs text-gray-500">
            {cardData.icon && <img src={cardData.icon} alt="" className="w-4 h-4 mr-2" />}
            <span className="truncate">{cardData.publisher || hostname}</span>
            {cardData.author && <span className="before:content-['•'] before:mx-1 truncate">{cardData.author}</span>}
          </div>
        </div>
        {cardData.thumbnail && (
          <div className="w-[140px] flex-shrink-0 relative overflow-hidden bg-gray-100 border-l hidden sm:block">
            <img src={cardData.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>
        )}
      </a>
    </figure>
  );
}
