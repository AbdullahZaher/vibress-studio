import { useEffect, useRef, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { type LexicalEditor } from 'lexical';
import { SlashMenuPlugin } from './plugins/SlashMenuPlugin';
import { FloatingFormatToolbarPlugin } from './plugins/FloatingFormatToolbarPlugin';
import { FloatingCardActionToolbarPlugin } from './plugins/FloatingCardActionToolbarPlugin';
import { BlockHandleGutterPlugin } from './plugins/BlockHandleGutterPlugin';
import { InlineAIPlugin, type StudioAiContext } from './plugins/InlineAIPlugin';
import { WordCountPlugin } from './plugins/WordCountPlugin';
import { STUDIO_CORE_NODES } from '@vibress/studio-nodes';
import { StudioCardNode } from '@vibress/studio-cards';
import { ReactStudioCardNode } from './nodes/ReactStudioCardNode';
import { StudioDocument, migrateDocument } from '@vibress/studio-core';
import { serializeStudioDocument } from '@vibress/studio-serializer';
import type { StudioPluginRegistry } from '@vibress/studio-plugin-sdk';
import { StudioUploadContext, StudioUploadApi } from './upload-context';
import { StudioMediaContext, StudioMediaApi, StudioMediaRequest } from './media-context';
import { StudioPluginContext } from './plugin-context';

export interface VibressStudioProps {
  value?: unknown;
  onChange?: (doc: StudioDocument) => void;
  /** Optional host integration for editor-specific commands; null on cleanup. */
  onEditorReady?: (editor: LexicalEditor | null) => void;
  readOnly?: boolean;
  /** AI UI is opt-in; a real host provider callback is also required. */
  enableAi?: boolean;
  onAiGenerate?: (prompt: string, context?: StudioAiContext) => Promise<string>;
  placeholder?: string;
  onError?: (error: Error) => void;
  requestMedia?: (req: StudioMediaRequest) => Promise<Record<string, unknown> | null>;
  /** Durable upload adapter: local file → assetId/src payload. Card editors
   *  must use this instead of transient blob: URLs. */
  uploadMedia?: StudioUploadApi['uploadMedia'];
  allowUnsplash?: boolean;
  showWordCount?: boolean;
  /** Optional plugin registry providing custom cards and capabilities. */
  pluginRegistry?: StudioPluginRegistry;
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

function EditorReadyPlugin({ onReady }: { onReady: (editor: LexicalEditor | null) => void }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    onReady(editor);
    return () => onReady(null);
  }, [editor, onReady]);
  return null;
}

/** Lexical 0.13 does not forward aria-label to its editable root reliably.
 * Label the actual root element, including after root replacements. */
function EditorAccessibleNamePlugin() {
  const [editor] = useLexicalComposerContext();
  useEffect(() => editor.registerRootListener((root) => {
    root?.setAttribute('aria-label', 'Editor content');
  }), [editor]);
  return null;
}

/**
 * Apply external document updates, but do not reset the editor (and its
 * selection/undo stack) when the parent merely echoes an onChange snapshot.
 * The current document is preserved if incoming content cannot be parsed.
 */
function DocumentSyncPlugin({ document, onError }: {
  document: StudioDocument;
  onError?: (error: Error) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const lastApplied = useRef<string | null>(null);

  useEffect(() => {
    const incoming = JSON.stringify(document.root);
    if (incoming === lastApplied.current) return;
    try {
      const current = serializeStudioDocument(editor.getEditorState().toJSON().root);
      if (JSON.stringify(current.root) !== incoming) {
        const next = editor.parseEditorState(JSON.stringify({
          root: { ...document.root, version: 1 },
        }));
        editor.setEditorState(next);
      }
      lastApplied.current = incoming;
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Unable to load Studio document'));
    }
  }, [editor, document, onError]);
  return null;
}

/** LexicalComposer.initialConfig is only read on mount. */
function EditorEditablePlugin({ readOnly }: { readOnly: boolean }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);
  return null;
}

export function VibressStudio({
  value,
  onChange,
  onEditorReady,
  readOnly = false,
  enableAi = false,
  onAiGenerate,
  placeholder = 'Begin writing your post...',
  onError,
  requestMedia,
  uploadMedia,
  allowUnsplash = true,
  showWordCount = true,
  pluginRegistry,
  className = '',
}: VibressStudioProps) {
  const parsedDoc = useMemo(() => migrateDocument(value), [value]);

  const initialConfig = useMemo(
    () => ({
      namespace: 'VibressStudio',
      nodes: [
        ...STUDIO_CORE_NODES,
        ReactStudioCardNode,
        {
          replace: StudioCardNode,
          // IMPORTANT: do not pass the original node's key. $setNodeKey
          // already registered the original under that key; a replacement
          // with the same key never enters the node map. A fresh key makes
          // the replacement the real rendered node.
          with: (node: StudioCardNode) => {
            return new ReactStudioCardNode(node.getCardType(), node.getCardData());
          },
        },
      ],
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
        list: {
          ul: 'studio-ul',
          ol: 'studio-ol',
          listitem: 'studio-listitem',
          nested: {
            listitem: 'studio-nested-listitem',
          },
          listitemChecked: 'studio-checklist-checked',
          listitemUnchecked: 'studio-checklist-unchecked',
        },
        table: 'studio-table',
        tableCell: 'studio-table-cell',
        tableCellHeader: 'studio-table-cell-header',
        tableRow: 'studio-table-row',
        quote: 'studio-quote',
        code: 'studio-code-block',
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

  const mediaContextValue = useMemo<StudioMediaApi>(
    () => ({
      uploadMedia,
      requestMedia,
      allowUnsplash,
    }),
    [uploadMedia, requestMedia, allowUnsplash]
  );

  return (
    <StudioErrorBoundary onError={onError}>
      <StudioPluginContext.Provider value={pluginRegistry || null}>
      <StudioUploadContext.Provider value={{ uploadMedia }}>
        <StudioMediaContext.Provider value={mediaContextValue}>
        <div className={`vibress-studio-editor ${className || ''}`}>
          <fieldset disabled={readOnly} style={{ minWidth: 0, margin: 0, padding: 0, border: 0 }}>
          <LexicalComposer initialConfig={initialConfig}>
            <div style={{ position: 'relative', minHeight: '30vh', paddingInlineStart: '32px' }}>
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    aria-label="Editor content"
                    style={{
                      outline: 'none',
                      minHeight: '30vh',
                      fontSize: '1.0625rem',
                      lineHeight: '1.75',
                      color: 'inherit',
                    }}
                  />
                }
                placeholder={
                  <div
                    style={{
                      position: 'absolute',
                      top: '0',
                      insetInlineStart: '32px',
                      color: '#475569',
                      pointerEvents: 'none',
                      fontSize: '1.0625rem',
                    }}
                  >
                    {placeholder}
                  </div>
                }
                ErrorBoundary={LexicalErrorBoundary}
              />
              <HistoryPlugin />
              <ListPlugin />
              <CheckListPlugin />
              <TablePlugin hasCellMerge hasCellBackgroundColor hasTabHandler />
              {!readOnly && <MarkdownShortcutPlugin transformers={TRANSFORMERS} />}
              <LinkPlugin />
              {!readOnly && <SlashMenuPlugin requestMedia={requestMedia} />}
              {!readOnly && <FloatingFormatToolbarPlugin />}
              {!readOnly && <FloatingCardActionToolbarPlugin />}
              {!readOnly && <BlockHandleGutterPlugin />}
              {!readOnly && enableAi && onAiGenerate && <InlineAIPlugin onGenerate={onAiGenerate} />}
              {showWordCount && <WordCountPlugin />}
              <EditorAccessibleNamePlugin />
              <EditorEditablePlugin readOnly={readOnly} />
              <DocumentSyncPlugin document={parsedDoc} onError={onError} />
              {onEditorReady && <EditorReadyPlugin onReady={onEditorReady} />}
              {onChange && (
                <OnChangePlugin
                  onChange={(editorState) => {
                    const rootNode = editorState.toJSON().root;
                    const studioDoc = serializeStudioDocument(rootNode);
                    onChange(studioDoc);
                  }}
                />
              )}
            </div>
          </LexicalComposer>
          </fieldset>
        </div>
        </StudioMediaContext.Provider>
      </StudioUploadContext.Provider>
      </StudioPluginContext.Provider>
    </StudioErrorBoundary>
  );
}
