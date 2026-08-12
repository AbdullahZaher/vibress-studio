import React, { useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useLexicalNodeSelection } from '@lexical/react/useLexicalNodeSelection';
import { mergeRegister } from '@lexical/utils';
import { $getNodeByKey, $getSelection, $isNodeSelection, COMMAND_PRIORITY_LOW, KEY_BACKSPACE_COMMAND, KEY_DELETE_COMMAND, NodeKey } from 'lexical';
import { STUDIO_CARD_DEFINITIONS } from '@vibress/studio-cards';
import { SafeHtml, sanitizeToSafeHtml } from '../security/SafeHtml';
import { CardErrorBoundary } from './CardErrorBoundary';
import { ImageCardEditor } from './cards/ImageCardEditor';
import { VideoCardEditor } from './cards/VideoCardEditor';
import { GalleryCardEditor } from './cards/GalleryCardEditor';
import { AudioCardEditor } from './cards/AudioCardEditor';
import { FileCardEditor } from './cards/FileCardEditor';
import { BookmarkCardEditor } from './cards/BookmarkCardEditor';
import { EmbedCardEditor } from './cards/EmbedCardEditor';
import { ButtonCardEditor } from './cards/ButtonCardEditor';
import { CalloutCardEditor } from './cards/CalloutCardEditor';
import { ToggleCardEditor } from './cards/ToggleCardEditor';
import { MarkdownCardEditor } from './cards/MarkdownCardEditor';
import { HtmlCardEditor } from './cards/HtmlCardEditor';

// Registry of cards that have rich interactive React editors
/**
 * Card editors receive their own validated card-data type (e.g. ImageCardData);
 * the registry widens the prop contract to unknown so heterogeneous editors can
 * be looked up by card type. The single cast below is the boundary between the
 * registry and the per-card prop types (no any).
 */
function asCardEditor<T>(
  component: React.FC<{ nodeKey: NodeKey; cardData: T }>
): React.FC<{ nodeKey: NodeKey; cardData: unknown }> {
  return component as React.FC<{ nodeKey: NodeKey; cardData: unknown }>;
}

const INTERACTIVE_CARDS: Record<string, React.FC<{ nodeKey: NodeKey; cardData: unknown }>> = {
  image: asCardEditor(ImageCardEditor),
  video: asCardEditor(VideoCardEditor),
  gallery: asCardEditor(GalleryCardEditor),
  audio: asCardEditor(AudioCardEditor),
  file: asCardEditor(FileCardEditor),
  bookmark: asCardEditor(BookmarkCardEditor),
  embed: asCardEditor(EmbedCardEditor),
  button: asCardEditor(ButtonCardEditor),
  callout: asCardEditor(CalloutCardEditor),
  toggle: asCardEditor(ToggleCardEditor),
  markdown: asCardEditor(MarkdownCardEditor),
  html: asCardEditor(HtmlCardEditor),
};

export function StudioCardComponent({
  cardType,
  cardData,
  nodeKey,
}: {
  cardType: string;
  cardData: Record<string, unknown>;
  nodeKey: NodeKey;
}) {
  const [editor] = useLexicalComposerContext();
  const [isSelected, setSelected, clearSelection] = useLexicalNodeSelection(nodeKey);

  const onDelete = useCallback(
    (payload: KeyboardEvent) => {
      if (isSelected && $isNodeSelection($getSelection())) {
        payload.preventDefault();
        const node = $getNodeByKey(nodeKey);
        if (node) {
          node.remove();
        }
        return true;
      }
      return false;
    },
    [isSelected, nodeKey]
  );

  React.useEffect(() => {
    return mergeRegister(
      editor.registerCommand(KEY_DELETE_COMMAND, onDelete, COMMAND_PRIORITY_LOW),
      editor.registerCommand(KEY_BACKSPACE_COMMAND, onDelete, COMMAND_PRIORITY_LOW)
    );
  }, [editor, onDelete]);

  // If we have an interactive editor component for this card type, render it
  // inside an error boundary so a single bad card never crashes the editor.
  const InteractiveEditor = INTERACTIVE_CARDS[cardType];
  if (InteractiveEditor) {
    return (
      <CardErrorBoundary nodeKey={nodeKey}>
        <InteractiveEditor nodeKey={nodeKey} cardData={cardData} />
      </CardErrorBoundary>
    );
  }

  // Otherwise, fallback to static HTML rendering. The output of every
  // built-in renderer is already sanitized; we additionally brand it through
  // the sanitizer boundary so only SafeHtml can mount it.
  const def = STUDIO_CARD_DEFINITIONS[cardType];
  let html = `[Unknown Card: ${cardType}]`;
  if (def) {
    try {
      const validated = def.validate(cardData);
      html = def.renderHtml(validated);
    } catch {
      html = `[Card: ${cardType}] Error`;
    }
  }
  const safeHtml = sanitizeToSafeHtml(html);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      clearSelection();
      setSelected(true);
    }
  };

  return (
    <div
      role="group"
      aria-label={`${cardType} card`}
      tabIndex={0}
      onClick={() => {
        clearSelection();
        setSelected(true);
      }}
      onKeyDown={onKeyDown}
      style={{
        outline: isSelected ? '2px solid #3b82f6' : 'none',
        position: 'relative',
        cursor: 'pointer',
        padding: '2px',
        borderRadius: '4px',
        transition: 'outline 0.1s ease',
      }}
    >
      <SafeHtml html={safeHtml} />
    </div>
  );
}
