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
import { StudioDocument, migrateDocument, CURRENT_STUDIO_VERSION, StudioMigrationError } from '@vibress/studio-core';
import { serializeStudioDocument } from '@vibress/studio-serializer';
import { StudioUploadContext, StudioUploadApi } from './upload-context';
import { StudioMediaContext, StudioMediaApi, StudioMediaRequest } from './media-context';

// Lexical can only serialize nodes for which it has registered node classes.
// Preserve forward-compatible documents by refusing to edit unsupported trees
// instead of loading a partial tree and publishing a lossy onChange snapshot.
const EDITABLE_STUDIO_NODE_TYPES = new Set([
  'root', 'paragraph', 'text', 'linebreak', 'tab',
  'heading', 'quote', 'list', 'listitem',
  'link', 'autolink', 'code', 'code-highlight',
  'table', 'tablerow', 'tablecell',
  'studio-card', 'react-studio-card',
]);

function findUnsupportedEditorNode(node: unknown): string | null {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return 'invalid node';
  }
  const entry = node as { type?: unknown; children?: unknown };
  if (typeof entry.type !== 'string' || !EDITABLE_STUDIO_NODE_TYPES.has(entry.type)) {
    return typeof entry.type === 'string' ? entry.type : 'missing node type';
  }
  if (entry.children !== undefined) {
    if (!Array.isArray(entry.children)) return entry.type + ' (invalid children)';
    for (const child of entry.children) {
      const unsupported = findUnsupportedEditorNode(child);
      if (unsupported) return unsupported;
    }
  }
  return null;
}

function assertEditorCanPreserveDocument(document: StudioDocument, rawDocument: unknown): void {
  if (document.version !== CURRENT_STUDIO_VERSION) {
    throw new StudioMigrationError(
      `Cannot edit Studio document version ${document.version} with a version ${CURRENT_STUDIO_VERSION} editor. Open it with a compatible editor instead.`,
      rawDocument,
      'UNSUPPORTED_DOCUMENT'
    );
  }
  const unsupportedNode = findUnsupportedEditorNode(document.root);
  if (unsupportedNode) {
    throw new StudioMigrationError(
      `Cannot safely edit unsupported Lexical node type: ${unsupportedNode}.`,
      rawDocument,
      'UNSUPPORTED_DOCUMENT'
    );
  }
}

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
  className = '',
}: VibressStudioProps) {
  const { parsedDoc, migrationError } = useMemo(() => {
    try {
      const doc = migrateDocument(value);
      assertEditorCanPreserveDocument(doc, value);
      return { parsedDoc: doc, migrationError: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      return { parsedDoc: null, migrationError: error };
    }
  }, [value]);

  useEffect(() => {
    if (migrationError && onError) {
      onError(migrationError);
    }
  }, [migrationError, onError]);

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

  if (migrationError || !parsedDoc) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className={`vibress-studio-editor studio-migration-error ${className || ''}`}
        style={{
          padding: '1.5rem',
          border: '1px solid #ef4444',
          borderRadius: '0.5rem',
          background: '#fef2f2',
          color: '#991b1b',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <strong style={{ fontSize: '1rem' }}>Studio Document Recovery</strong>
          <span style={{ fontSize: '0.8125rem', padding: '2px 8px', borderRadius: '9999px', background: '#fee2e2' }}>
            Content Preserved
          </span>
        </div>
        <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.875rem', lineHeight: '1.5' }}>
          The document could not be loaded because the persisted format is unsupported or invalid.
          The original content has been retained without overwriting.
        </p>
        <pre
          style={{
            margin: '0',
            padding: '0.75rem',
            background: '#ffffff',
            border: '1px solid #fca5a5',
            borderRadius: '0.375rem',
            fontSize: '0.8125rem',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {migrationError?.message || 'Unsupported persisted document'}
        </pre>
      </div>
    );
  }

  return (
    <StudioErrorBoundary onError={onError}>
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
    </StudioErrorBoundary>
  );
}
