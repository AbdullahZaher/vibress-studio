import { useState, useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalNestedComposer } from '@lexical/react/LexicalNestedComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import LexicalErrorBoundary from '@lexical/react/LexicalErrorBoundary';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import {
  createEditor,
  EditorState,
  ParagraphNode,
  TextNode,
  $getRoot,
  $createParagraphNode,
  $createTextNode,
} from 'lexical';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { $generateHtmlFromNodes } from '@lexical/html';
import { sanitizeStudioHtml, stripHtml } from '@vibress/studio-utils';

export interface NestedCaptionEditorProps {
  initialCaptionJSON?: Record<string, unknown> | undefined;
  initialCaptionText?: string | undefined;
  captionHtml?: string | undefined;
  placeholder?: string;
  readOnly?: boolean;
  onChange: (captionJSON: Record<string, unknown>, captionHtml: string) => void;
  onError?: (error: Error, rawCaption?: unknown) => void;
}

const CAPTION_NODES = [ParagraphNode, TextNode, LinkNode, AutoLinkNode];

function cleanCaptionText(text?: string): string {
  if (!text) return '';
  if (text.includes('<') && text.includes('>')) {
    return stripHtml(text).trim();
  }
  return text;
}

function extractTextFromUnknown(input: unknown): string {
  if (typeof input === 'string') return input;
  if (!input || typeof input !== 'object') return '';
  const parts: string[] = [];
  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (typeof record.text === 'string' && record.text.length > 0) {
      parts.push(record.text);
    }
    if (Array.isArray(record.children)) {
      for (const child of record.children) {
        walk(child);
      }
    }
  }
  walk(input);
  return parts.join(' ').trim();
}

export function NestedCaptionEditor({
  initialCaptionJSON,
  initialCaptionText,
  captionHtml,
  placeholder = 'Type caption...',
  readOnly,
  onChange,
  onError,
}: NestedCaptionEditorProps) {
  const [parentEditor] = useLexicalComposerContext();
  const [isParentEditable, setIsParentEditable] = useState(() => parentEditor.isEditable());

  useEffect(() => {
    return parentEditor.registerEditableListener((editable) => {
      setIsParentEditable(editable);
    });
  }, [parentEditor]);

  const isReadOnly = readOnly !== undefined ? readOnly : !isParentEditable;

  const lastEmittedJsonRef = useRef<string>('');
  const lastEmittedHtmlRef = useRef<string>('');
  // Keep unsupported persisted caption JSON intact until the author explicitly
  // approves a fallback. A successful load must never silently rewrite it.
  const invalidCaptionJsonRef = useRef<string | null>(null);

  const [captionEditor] = useState(() => {
    const editor = createEditor({
      nodes: CAPTION_NODES,
      theme: {
        paragraph: 'vibress-caption-paragraph',
        link: 'vibress-caption-link',
        text: {
          bold: 'vibress-caption-bold',
          italic: 'vibress-caption-italic',
          underline: 'vibress-caption-underline',
          strikethrough: 'vibress-caption-strikethrough',
        },
      },
      namespace: 'vibress-caption',
      editable: !isReadOnly,
      onError: (e) => {
        if (onError) onError(e);
        else console.error('Caption editor error:', e);
      },
    });

    let initialized = false;
    if (initialCaptionJSON && Object.keys(initialCaptionJSON).length > 0) {
      try {
        const parsed = editor.parseEditorState(JSON.stringify(initialCaptionJSON));
        editor.setEditorState(parsed);
        initialized = true;
      } catch (err) {
        invalidCaptionJsonRef.current = JSON.stringify(initialCaptionJSON);
        if (onError) {
          onError(err instanceof Error ? err : new Error(String(err)), initialCaptionJSON);
        }
      }
    }

    if (!initialized) {
      const text = extractTextFromUnknown(initialCaptionJSON) || cleanCaptionText(initialCaptionText);
      if (text.trim().length > 0) {
        editor.update(
          () => {
            const root = $getRoot();
            root.clear();
            const p = $createParagraphNode();
            p.append($createTextNode(text));
            root.append(p);
          },
          { discrete: true }
        );
      }
    }

    return editor;
  });

  const [recoveryRequired, setRecoveryRequired] = useState(invalidCaptionJsonRef.current !== null);

  useEffect(() => {
    captionEditor.setEditable(!isReadOnly && !recoveryRequired);
  }, [captionEditor, isReadOnly, recoveryRequired]);

  useEffect(() => {
    if (initialCaptionJSON && Object.keys(initialCaptionJSON).length > 0) {
      const jsonString = JSON.stringify(initialCaptionJSON);
      // Avoid parsing the same corrupt JSON repeatedly while the recoverable
      // warning is shown. A newly provided, valid external caption can load.
      if (recoveryRequired && invalidCaptionJsonRef.current === jsonString) return;
      if (jsonString !== lastEmittedJsonRef.current) {
        try {
          const parsed = captionEditor.parseEditorState(jsonString);
          captionEditor.setEditorState(parsed);
          lastEmittedJsonRef.current = jsonString;
          invalidCaptionJsonRef.current = null;
          if (recoveryRequired) setRecoveryRequired(false);
          return;
        } catch (err) {
          invalidCaptionJsonRef.current = jsonString;
          setRecoveryRequired(true);
          if (onError) {
            onError(err instanceof Error ? err : new Error(String(err)), initialCaptionJSON);
          }
        }
      }
    }

    const cleanText = cleanCaptionText(initialCaptionText);
    if (
      initialCaptionText !== undefined &&
      cleanText !== lastEmittedHtmlRef.current &&
      (!initialCaptionJSON || Object.keys(initialCaptionJSON).length === 0)
    ) {
      captionEditor.update(
        () => {
          const root = $getRoot();
          if (root.getTextContent() !== cleanText) {
            root.clear();
            if (cleanText) {
              const p = $createParagraphNode();
              p.append($createTextNode(cleanText));
              root.append(p);
            }
          }
        },
        { discrete: true }
      );
      lastEmittedHtmlRef.current = cleanText;
    }
  }, [initialCaptionJSON, initialCaptionText, captionEditor, onError, recoveryRequired]);

  const recoverAsText = () => {
    // This is an explicit author action: the unsupported raw JSON stays
    // untouched until this point and can be recovered through onError.
    invalidCaptionJsonRef.current = null;
    const state = captionEditor.getEditorState();
    state.read(() => {
      const text = $getRoot().getTextContent();
      const html = text.trim() ? sanitizeStudioHtml($generateHtmlFromNodes(captionEditor, null)) : '';
      const json = text.trim()
        ? (state.toJSON() as unknown as Record<string, unknown>)
        : {};
      lastEmittedJsonRef.current = JSON.stringify(json);
      lastEmittedHtmlRef.current = html;
      onChange(json, html);
    });
    setRecoveryRequired(false);
  };

  if (isReadOnly) {
    const displayHtml = captionHtml;
    const displayText = initialCaptionText || extractTextFromUnknown(initialCaptionJSON);
    if (!displayHtml && !displayText) {
      return null;
    }
    return (
      <figcaption
        className="vibress-caption mt-2 text-center text-xs text-muted-foreground"
        dangerouslySetInnerHTML={
          displayHtml ? { __html: sanitizeStudioHtml(displayHtml) } : undefined
        }
      >
        {displayHtml ? undefined : displayText}
      </figcaption>
    );
  }

  return (
    <LexicalNestedComposer initialEditor={captionEditor}>
      <div className="vibress-caption-editor relative mt-2 text-center text-xs text-muted-foreground">
        {recoveryRequired && (
          <div role="alert" className="mb-2 rounded-md border border-amber-500 p-2 text-start">
            <p>Saved caption data could not be read safely. The original is preserved. Review the recovered text before replacing it.</p>
            <button type="button" onClick={recoverAsText} className="mt-1 rounded border px-2 py-1 font-medium">
              Use recovered text
            </button>
          </div>
        )}
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              className="outline-none min-h-[24px] px-2 py-1 focus:bg-muted/40 dark:focus:bg-white/[0.04] rounded-lg transition text-foreground/80 placeholder:text-muted-foreground"
              ariaLabel={placeholder}
            />
          }
          placeholder={
            <div className="absolute top-1 left-0 right-0 pointer-events-none opacity-50 text-muted-foreground select-none">
              {placeholder}
            </div>
          }
          ErrorBoundary={LexicalErrorBoundary}
        />
        <HistoryPlugin />
        <OnChangePlugin
          onChange={(editorState: EditorState, editor) => {
            if (recoveryRequired) return;
            editorState.read(() => {
              const text = $getRoot().getTextContent();
              const trimmed = text.trim();
              const html = trimmed.length > 0 ? $generateHtmlFromNodes(editor, null) : '';
              const json =
                trimmed.length > 0
                  ? (editorState.toJSON() as unknown as Record<string, unknown>)
                  : {};
              lastEmittedJsonRef.current = JSON.stringify(json);
              lastEmittedHtmlRef.current = html;
              onChange(json, html);
            });
          }}
        />
      </div>
    </LexicalNestedComposer>
  );
}
