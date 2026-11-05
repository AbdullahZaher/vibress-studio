import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { NodeKey, $getNodeByKey } from 'lexical';
import { BookmarkCardData, StudioCardNode } from '@vibress/studio-cards';

import { UrlPlaceholder } from '../ui/UrlPlaceholder';
import { parseSafeBookmarkUrl, isSafeBookmarkImageUrl } from './bookmark-url';

interface Props {
  nodeKey: NodeKey;
  cardData: BookmarkCardData;
}

export function BookmarkCardEditor({ nodeKey, cardData }: Props) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);

  const isPopulated = !!cardData.url;
  const safeBookmark = parseSafeBookmarkUrl(cardData.url);
  const iconSrc = isSafeBookmarkImageUrl(cardData.icon) ? cardData.icon : null;
  const thumbnailSrc = isSafeBookmarkImageUrl(cardData.thumbnail) ? cardData.thumbnail : null;

  const onUrlSubmit = (url: string) => {
    const parsed = parseSafeBookmarkUrl(url);
    if (!parsed) return;
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node instanceof StudioCardNode && node.isAttached()) {
        const current = node.getCardData();
        node.setCardData({
          ...current,
          url: parsed.href,
          title: typeof current.title === 'string' && current.title ? current.title : parsed.hostname,
        });
      }
    });
  };

  // Unsupported persisted URLs are kept in cardData but cannot be navigated.
  // Offer the real URL-entry control to repair the card without crashing Lexical.
  if (!isPopulated || !safeBookmark) {
    return (
      <UrlPlaceholder
        iconType="bookmark"
        title="Bookmark"
        description={isPopulated ? "Saved bookmark URL is invalid. Enter an HTTP or HTTPS address to repair." : "Paste a URL to add a bookmark"}
        onUrlSubmit={onUrlSubmit}
        isSelected={isSelected}
        onClick={() => {
          clearSelection();
          setSelected(true);
        }}
      />
    );
  }

  return (
    <figure
      className={`vb-bookmark-card relative w-full my-3`}
      onClick={() => {
        clearSelection();
        setSelected(true);
      }}
      style={{
        outline: isSelected ? '2px solid #3b82f6' : 'none',
        transition: 'outline 0.1s ease',
      }}
    >
      <a
        href={safeBookmark.href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex border border-border/80 dark:border-white/10 rounded-xl overflow-hidden hover:bg-muted/40 dark:hover:bg-white/[0.04] bg-card dark:bg-[#1a1c20]/90 backdrop-blur-md no-underline text-foreground shadow-sm transition-all"
        style={{ height: '112px' }}
      >
        <div className="flex flex-col flex-1 p-3 px-4 justify-between min-w-0">
          <div>
            <div className="font-semibold truncate mb-1 text-sm text-foreground">{cardData.title || cardData.url}</div>
            <div className="text-xs text-muted-foreground line-clamp-2">{cardData.description}</div>
          </div>
          <div className="flex items-center mt-2 text-[11px] text-muted-foreground">
            {iconSrc && <img src={iconSrc} alt="" className="w-3.5 h-3.5 mr-1.5 rounded" />}
            <span className="truncate">{cardData.publisher || safeBookmark.hostname}</span>
            {cardData.author && <span className="before:content-['•'] before:mx-1 truncate">{cardData.author}</span>}
          </div>
        </div>
        {thumbnailSrc && (
          <div className="w-[130px] flex-shrink-0 relative overflow-hidden bg-muted/60 dark:bg-white/[0.04] border-l border-border/60 dark:border-white/10 hidden sm:block">
            <img src={thumbnailSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>
        )}
      </a>
    </figure>
  );
}
