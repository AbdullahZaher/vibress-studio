import { useEffect, useRef, useState, useMemo, useCallback, Component, ErrorInfo, ReactNode } from 'react';
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
import { type LexicalEditor, type SerializedEditorState } from 'lexical';
import { SlashMenuPlugin } from './plugins/SlashMenuPlugin';
import { FloatingFormatToolbarPlugin } from './plugins/FloatingFormatToolbarPlugin';
import { FloatingCardActionToolbarPlugin } from './plugins/FloatingCardActionToolbarPlugin';
import { BlockHandleGutterPlugin } from './plugins/BlockHandleGutterPlugin';
import { InlineAIPlugin, type StudioAiContext } from './plugins/InlineAIPlugin';
import { WordCountPlugin } from './plugins/WordCountPlugin';
import { STUDIO_CORE_NODES } from '@vibress/studio-nodes';
import { StudioCardNode } from '@vibress/studio-cards';
import { ReactStudioCardNode } from './nodes/ReactStudioCardNode';
import { StudioDocument, migrateDocument, createEmptyStudioDocument, assertStudioDocumentEditable, type DocumentResourceLimits } from '@vibress/studio-core';
import { serializeStudioDocument } from '@vibress/studio-serializer';
import type { StudioPluginRegistry } from '@vibress/studio-plugin-sdk';
import { StudioPluginContext } from './plugin-context';
import { StudioUploadContext, StudioUploadApi } from './upload-context';
import { StudioMediaContext, StudioMediaApi, StudioMediaRequest } from './media-context';
import { preserveSerializedTableDirections, restoreImportedNodeProperties } from './utils/lexicalCompatibility';
import { validateCardPayloads } from './utils/validateCardPayloads';
import { DocumentRecovery } from './components/DocumentRecovery';

export interface StudioRecoveryData {
  readonly originalValue: unknown;
  readonly error: Error;
  /** Raw current editor state, including edits not admitted for autosave. */
  readonly editorState?: SerializedEditorState;
  readonly lastAcceptedDocument?: StudioDocument;
}

export interface VibressStudioProps {
  value?: unknown;
  /** Optional shared input/output resource policy; defaults to 5 MiB/50k nodes/depth 64. */
  resourceLimits?: DocumentResourceLimits;
  /** Host persistence revision metadata. An autosave revision increment never
   * authorizes replacing newer local edits. */
  revisionId?: string | number;
  /** Explicit host command to replace the editor document (revision restore,
   * document switch, authorized remote update). Change this token only for an
   * intentional replacement, never for autosave acknowledgments. */
  replacementId?: string | number;
  /** Authorizes envelope-only updates using a monotonically increasing safe
   * integer (>= 0) within one replacementId epoch. The host must attach the
   * sequence assigned to that metadata snapshot, not its response arrival order.
   * Never authorizes a root replacement. Omitted/equal/older values cannot
   * update metadata. A changed replacementId starts a new sequence. */
  metadataRevision?: number;
  onChange?: (doc: StudioDocument) => void;
  /** Optional host integration for editor-specific commands; null on cleanup. */
  onEditorReady?: (editor: LexicalEditor | null) => void;
  readOnly?: boolean;
  /** AI UI is opt-in; a real host provider callback is also required. */
  enableAi?: boolean;
  onAiGenerate?: (prompt: string, context?: StudioAiContext) => Promise<string>;
  placeholder?: string;
  onError?: (error: Error) => void;
  /** Host-owned export/recovery action; omitted actions are not displayed. */
  onRequestRecovery?: (data: StudioRecoveryData) => void | Promise<void>;
  /** Recovery messages only; does not infer or change document direction. */
  recoveryLocale?: 'en' | 'ar';
  requestMedia?: (req: StudioMediaRequest) => Promise<Record<string, unknown> | null>;
  /** Durable upload adapter: local file → assetId/src payload. Card editors
   *  must use this instead of transient blob: URLs. */
  uploadMedia?: StudioUploadApi['uploadMedia'];
  allowUnsplash?: boolean;
  showWordCount?: boolean;
  /** Optional trusted in-process plugin registry for custom card rendering and discovery. */
  pluginRegistry?: StudioPluginRegistry;
  dir?: 'ltr' | 'rtl' | 'auto';
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
const STUDIO_EXTERNAL_SYNC_TAG = 'studio-external-sync';

/**
 * Once local content has changed, an unversioned incoming value is ambiguous:
 * it might be an old autosave response or a legitimate external replacement.
 * Preserve the author's live draft in either case. Hosts must change
 * replacementId to explicitly authorize switching/reloading this document.
 * revisionId is informational only; incrementing it must not lose draft edits.
 * metadataRevision authorizes ordered envelope-only acknowledgments, never roots.
 */
function DocumentSyncPlugin({
  document,
  replacementId,
  metadataRevision,
  onError,
  hasLocalEdits,
  onExternalApplied,
  onMetadataApplied,
}: {
  document: StudioDocument | null;
  replacementId?: string | number;
  metadataRevision?: number;
  onError?: (error: Error) => void;
  hasLocalEdits: () => boolean;
  onExternalApplied: (document: StudioDocument) => void;
  onMetadataApplied: (document: StudioDocument) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const lastObservedIncoming = useRef<string | null>(null);
  const lastReplacementId = useRef<string | number | undefined>(replacementId);
  const acceptedMetadataRevision = useRef(-1);
  const orderedMetadata = useRef(false);

  useEffect(() => {
    // Keep this plugin mounted during recovery so rejected replacements do
    // not consume a token or reset the existing synchronization history.
    if (!document) return;
    const isFirstDocument = lastObservedIncoming.current === null;
    const incoming = JSON.stringify(document.root);
    const isExplicitReplacement =
      replacementId !== undefined && replacementId !== lastReplacementId.current;

    const validMetadataRevision = metadataRevision !== undefined &&
      Number.isSafeInteger(metadataRevision) && metadataRevision >= 0;
    if (!isFirstDocument && !isExplicitReplacement &&
        (metadataRevision !== undefined || orderedMetadata.current)) {
      // An ordered metadata snapshot authorizes only its envelope. Its root
      // may be an old autosave snapshot, even before the first local edit.
      if (validMetadataRevision && metadataRevision > acceptedMetadataRevision.current) {
        onMetadataApplied(document);
        acceptedMetadataRevision.current = metadataRevision;
        orderedMetadata.current = true;
      }
      return;
    }
    if (incoming === lastObservedIncoming.current && !isExplicitReplacement) return;

    try {
      const current = serializeStudioDocument(preserveSerializedTableDirections(editor.getEditorState().toJSON().root));
      const currentJson = JSON.stringify(current.root);

      if (currentJson !== incoming) {
        if (!isExplicitReplacement && hasLocalEdits()) {
          // Never infer "new external document" from unseen JSON: an old echo
          // can arrive after arbitrary numbers of newer local edits.
          lastObservedIncoming.current = incoming;
          lastReplacementId.current = replacementId;
          return;
        }

        // A valid persisted empty root needs Lexical's empty paragraph before
        // setEditorState, which rejects a root with no children. No content is
        // replaced or truncated by this editor-only empty-state adaptation.
        const root = document.root.children.length ? document.root : {
          ...document.root, children: createEmptyStudioDocument().root.children,
        };
        const next = editor.parseEditorState(JSON.stringify({
          root: { ...root, version: 1 },
        }), () => restoreImportedNodeProperties(root));
        editor.setEditorState(next, { tag: STUDIO_EXTERNAL_SYNC_TAG });
      }

      lastObservedIncoming.current = incoming;
      lastReplacementId.current = replacementId;
      acceptedMetadataRevision.current = validMetadataRevision ? metadataRevision : -1;
      orderedMetadata.current = metadataRevision !== undefined;
      if (isFirstDocument || isExplicitReplacement || currentJson !== incoming) {
        onExternalApplied(document);
      }
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Unable to load Studio document'));
    }
  }, [editor, document, replacementId, metadataRevision, onError, hasLocalEdits, onExternalApplied, onMetadataApplied]);

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
  resourceLimits,
  revisionId,
  replacementId,
  metadataRevision,
  onChange,
  onEditorReady,
  readOnly = false,
  enableAi = false,
  onAiGenerate,
  placeholder = 'Begin writing your post...',
  onError,
  onRequestRecovery,
  recoveryLocale = 'en',
  requestMedia,
  uploadMedia,
  allowUnsplash = true,
  showWordCount = true,
  pluginRegistry,
  dir,
  className = '',
}: VibressStudioProps) {
  const hasLocalEditsRef = useRef(false);
  const lastObservedEditorRootRef = useRef<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<Error | null>(null);
  const [hasLoadedDocument, setHasLoadedDocument] = useState(false);
  const acceptedDocumentRef = useRef<StudioDocument | undefined>(undefined);
  const editorInstanceRef = useRef<LexicalEditor | null>(null);
  const handleEditorReady = useCallback((editor: LexicalEditor | null) => {
    editorInstanceRef.current = editor;
    onEditorReady?.(editor);
  }, [onEditorReady]);

  const hasLocalEdits = useCallback(() => hasLocalEditsRef.current, []);
  const onExternalApplied = useCallback((document: StudioDocument) => {
    lastObservedEditorRootRef.current = JSON.stringify(document.root);
    acceptedDocumentRef.current = document;
    setSnapshotError(null);
    hasLocalEditsRef.current = false;
  }, []);

  const onMetadataApplied = useCallback((document: StudioDocument) => {
    // Do not reset dirty tracking, selection, history, or the observed root.
    // Serialization combines this admitted envelope with the live editor root.
    acceptedDocumentRef.current = document;
  }, []);

  // revisionId is an acknowledgment/revision label for the host. It is never
  // interpreted as an authorized replacement. See replacementId above.
  void revisionId;

  const { parsedDoc, migrationError } = useMemo(() => {
    try {
      const doc = migrateDocument(value, resourceLimits);
      assertStudioDocumentEditable(doc, value);
      validateCardPayloads(doc, value);
      return { parsedDoc: doc, migrationError: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      return { parsedDoc: null, migrationError: error };
    }
  }, [value, resourceLimits]);

  useEffect(() => {
    if (parsedDoc) setHasLoadedDocument(true);
  }, [parsedDoc]);

  useEffect(() => {
    if (migrationError && onError) {
      onError(migrationError);
    }
  }, [migrationError, onError]);

  const editingPaused = readOnly || Boolean(migrationError);

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
      editable: !editingPaused,
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
    [editingPaused, onError]
  );

  const mediaContextValue = useMemo<StudioMediaApi>(
    () => ({
      uploadMedia,
      requestMedia,
      allowUnsplash,
    }),
    [uploadMedia, requestMedia, allowUnsplash]
  );

  const recoveryError = migrationError || snapshotError;
  const recoveryNotice = recoveryError ? (
    <DocumentRecovery error={recoveryError} hasDraft={hasLoadedDocument} locale={recoveryLocale} kind={migrationError ? 'input' : 'snapshot'}
      onRequestRecovery={onRequestRecovery ? () => onRequestRecovery({
        originalValue: value,
        error: recoveryError,
        editorState: editorInstanceRef.current?.getEditorState().toJSON(),
        lastAcceptedDocument: acceptedDocumentRef.current,
      }) : undefined}
    />
  ) : null;

  if (!parsedDoc && !hasLoadedDocument) {
    return <div className={`vibress-studio-editor studio-migration-error ${className || ''}`}>{recoveryNotice}</div>;
  }

  return (
    <StudioErrorBoundary onError={onError}>
      <StudioPluginContext.Provider value={pluginRegistry || null}>
      <StudioUploadContext.Provider value={{ uploadMedia }}>
        <StudioMediaContext.Provider value={mediaContextValue}>
        <div className={`vibress-studio-editor ${className || ''}`} dir={dir}>
          {recoveryNotice}
          <fieldset disabled={editingPaused} style={{ minWidth: 0, margin: 0, padding: 0, border: 0 }}>
          <LexicalComposer initialConfig={initialConfig}>
            <div className="vibress-studio-canvas" style={{ position: 'relative', minHeight: '30vh' }}>
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    aria-label="Editor content"
                    dir={dir}
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
                    className="vibress-studio-placeholder"
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      top: '0',
                      insetInlineStart: '0',
                      pointerEvents: 'none',
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
              {!editingPaused && <MarkdownShortcutPlugin transformers={TRANSFORMERS} />}
              <LinkPlugin />
              {!editingPaused && <SlashMenuPlugin requestMedia={requestMedia} />}
              {!editingPaused && <FloatingFormatToolbarPlugin />}
              {!editingPaused && <FloatingCardActionToolbarPlugin />}
              {!editingPaused && <BlockHandleGutterPlugin />}
              {!editingPaused && enableAi && onAiGenerate && <InlineAIPlugin onGenerate={onAiGenerate} />}
              {showWordCount && <WordCountPlugin />}
              <EditorAccessibleNamePlugin />
              <EditorEditablePlugin readOnly={editingPaused} />
              <DocumentSyncPlugin
                document={parsedDoc}
                replacementId={replacementId}
                metadataRevision={metadataRevision}
                onError={onError}
                hasLocalEdits={hasLocalEdits}
                onExternalApplied={onExternalApplied}
                onMetadataApplied={onMetadataApplied}
              />
              <EditorReadyPlugin onReady={handleEditorReady} />
              <OnChangePlugin
                onChange={(editorState, _editor, tags) => {
                  if (tags.has(STUDIO_EXTERNAL_SYNC_TAG)) return;
                  if (migrationError) {
                    // Pending uploads may still finish while editing is paused.
                    // Keep their changes local; never autosave over rejected data.
                    hasLocalEditsRef.current = true;
                    return;
                  }
                  // A rejected snapshot must never be emitted to host autosave,
                  // and the active Lexical editor state must never be reset.
                  try {
                    const studioDoc = serializeStudioDocument(preserveSerializedTableDirections(editorState.toJSON().root), resourceLimits, acceptedDocumentRef.current);
                    validateCardPayloads(studioDoc, studioDoc);
                    const rootJson = JSON.stringify(studioDoc.root);
                    if (rootJson === lastObservedEditorRootRef.current) return;
                    lastObservedEditorRootRef.current = rootJson;
                    hasLocalEditsRef.current = true;
                    setSnapshotError(null);
                    onChange?.(studioDoc);
                  } catch (error) {
                    const recoverable = error instanceof Error ? error : new Error(String(error));
                    hasLocalEditsRef.current = true;
                    setSnapshotError(recoverable);
                    onError?.(recoverable);
                  }
                }}
              />
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
