import { useEffect, useState, useRef, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { FORMAT_TEXT_COMMAND, UNDO_COMMAND, REDO_COMMAND, $getRoot, $createParagraphNode, $createTextNode } from 'lexical';
import { $createHeadingNode } from '@lexical/rich-text';
import { INSERT_UNORDERED_LIST_COMMAND, INSERT_ORDERED_LIST_COMMAND } from '@lexical/list';
import { STUDIO_CORE_NODES } from '@vibress/studio-nodes';
import { StudioCardNode, $createStudioCardNode, STUDIO_CARD_DEFINITIONS } from '@vibress/studio-cards';
import { StudioDocument, migrateDocument } from '@vibress/studio-core';
import { serializeStudioDocument } from '@vibress/studio-serializer';

export interface VibressStudioProps {
  value?: unknown;
  onChange?: (doc: StudioDocument) => void;
  readOnly?: boolean;
  placeholder?: string;
  onError?: (error: Error) => void;
  className?: string;
}

interface StudioErrorBoundaryProps {
  children: ReactNode;
  onError?: ((err: Error) => void) | undefined;
}

class StudioErrorBoundary extends Component<StudioErrorBoundaryProps, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _errorInfo: ErrorInfo) {
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '12px', border: '1px solid red', borderRadius: '4px', background: '#fff0f0', color: '#c00' }}>
          <strong>Studio Error:</strong> The editor encountered an issue displaying content.
        </div>
      );
    }
    return this.props.children;
  }
}

function Toolbar({ readOnly }: { readOnly?: boolean }) {
  const [editor] = useLexicalComposerContext();
  const [showCardMenu, setShowCardMenu] = useState(false);

  if (readOnly) return null;

  const insertCard = (cardType: string) => {
    editor.update(() => {
      const cardNode = $createStudioCardNode(cardType, { text: 'New ' + cardType });
      $getRoot().append(cardNode);
    });
    setShowCardMenu(false);
  };

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '8px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', borderRadius: '6px 6px 0 0' }}>
      <button type="button" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')} style={{ padding: '4px 8px', fontWeight: 'bold', cursor: 'pointer' }}>B</button>
      <button type="button" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')} style={{ padding: '4px 8px', fontStyle: 'italic', cursor: 'pointer' }}>I</button>
      <button type="button" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline')} style={{ padding: '4px 8px', textDecoration: 'underline', cursor: 'pointer' }}>U</button>
      <button type="button" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough')} style={{ padding: '4px 8px', textDecoration: 'line-through', cursor: 'pointer' }}>S</button>
      <button type="button" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'code')} style={{ padding: '4px 8px', fontFamily: 'monospace', cursor: 'pointer' }}>&lt;/&gt;</button>
      <div style={{ width: '1px', background: '#cbd5e1', margin: '0 4px' }} />
      <button type="button" onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)} style={{ padding: '4px 8px', cursor: 'pointer' }}>• List</button>
      <button type="button" onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)} style={{ padding: '4px 8px', cursor: 'pointer' }}>1. List</button>
      <div style={{ width: '1px', background: '#cbd5e1', margin: '0 4px' }} />
      <button type="button" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} style={{ padding: '4px 8px', cursor: 'pointer' }}>↩ Undo</button>
      <button type="button" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} style={{ padding: '4px 8px', cursor: 'pointer' }}>↪ Redo</button>
      <div style={{ width: '1px', background: '#cbd5e1', margin: '0 4px' }} />
      <div style={{ position: 'relative' }}>
        <button type="button" onClick={() => setShowCardMenu(!showCardMenu)} style={{ padding: '4px 8px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          + Insert Card
        </button>
        {showCardMenu && (
          <div style={{ position: 'absolute', zIndex: 100, background: 'white', border: '1px solid #cbd5e1', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '4px' }}>
            {Object.keys(STUDIO_CARD_DEFINITIONS).map((type) => (
              <button key={type} type="button" onClick={() => insertCard(type)} style={{ textAlign: 'left', padding: '6px 10px', background: '#f1f5f9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>
                {type}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InitialStatePlugin({ document }: { document: StudioDocument }) {
  const [editor] = useLexicalComposerContext();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    editor.update(() => {
      const root = $getRoot();
      root.clear();

      if (document && document.root && Array.isArray(document.root.children)) {
        for (const childNode of document.root.children as any[]) {
          if (childNode.type === 'paragraph') {
            const p = $createParagraphNode();
            if (Array.isArray(childNode.children)) {
              for (const textChild of childNode.children) {
                if (textChild.type === 'text') {
                  const textNode = $createTextNode(textChild.text || '');
                  if (typeof textChild.format === 'number') {
                    textNode.setFormat(textChild.format);
                  }
                  p.append(textNode);
                }
              }
            }
            root.append(p);
          } else if (childNode.type === 'heading') {
            const tag = childNode.tag || 'h2';
            const h = $createHeadingNode(tag);
            if (Array.isArray(childNode.children)) {
              for (const textChild of childNode.children) {
                if (textChild.type === 'text') {
                  h.append($createTextNode(textChild.text || ''));
                }
              }
            }
            root.append(h);
          } else if (childNode.type === 'studio-card') {
            const card = $createStudioCardNode(childNode.cardType, childNode.cardData || {});
            root.append(card);
          } else {
            // Default paragraph fallback
            const p = $createParagraphNode();
            p.append($createTextNode(JSON.stringify(childNode)));
            root.append(p);
          }
        }
      }

      if (root.getChildrenSize() === 0) {
        root.append($createParagraphNode());
      }
    });
  }, [document, editor]);

  return null;
}

export function VibressStudio({
  value,
  onChange,
  readOnly = false,
  placeholder = 'Write content with Vibress Studio...',
  onError,
  className = '',
}: VibressStudioProps) {
  const parsedDoc = useMemo(() => migrateDocument(value), [value]);

  const initialConfig = useMemo(
    () => ({
      namespace: 'VibressStudio',
      nodes: [...STUDIO_CORE_NODES, StudioCardNode],
      editable: !readOnly,
      onError: (error: Error) => {
        if (onError) onError(error);
      },
      theme: {
        paragraph: 'studio-paragraph',
        heading: {
          h1: 'studio-h1',
          h2: 'studio-h2',
          h3: 'studio-h3',
        },
        text: {
          bold: 'studio-bold',
          italic: 'studio-italic',
          underline: 'studio-underline',
          strikethrough: 'studio-strikethrough',
          code: 'studio-code',
        },
      },
    }),
    [readOnly, onError]
  );

  return (
    <StudioErrorBoundary onError={onError}>
      <div className={`vibress-studio-editor ${className}`} style={{ border: '1px solid #cbd5e1', borderRadius: '6px', background: '#ffffff', overflow: 'hidden' }}>
        <LexicalComposer initialConfig={initialConfig}>
          <Toolbar readOnly={readOnly} />
          <div style={{ position: 'relative', padding: '12px 16px', minHeight: '200px' }}>
            <RichTextPlugin
              contentEditable={<ContentEditable style={{ outline: 'none', minHeight: '180px' }} />}
              placeholder={
                <div style={{ position: 'absolute', top: '12px', left: '16px', color: '#94a3b8', pointerEvents: 'none' }}>
                  {placeholder}
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <ListPlugin />
            <LinkPlugin />
            <InitialStatePlugin document={parsedDoc} />
            {onChange && (
              <OnChangePlugin
                onChange={(editorState) => {
                  editorState.read(() => {
                    const rootNode = $getRoot().exportJSON();
                    const studioDoc = serializeStudioDocument(rootNode);
                    onChange(studioDoc);
                  });
                }}
              />
            )}
          </div>
        </LexicalComposer>
      </div>
    </StudioErrorBoundary>
  );
}
