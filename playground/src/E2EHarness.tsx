import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VibressStudio } from '@vibress/studio-react';
import { SafeHtml, sanitizeToSafeHtml } from '@vibress/studio-react';
import {
  StudioDocument,
  createEmptyStudioDocument,
  StudioUploadAdapter,
  StudioUploadContext,
  StudioUploadedAsset,
  StudioUploadHandlers,
} from '@vibress/studio-core';
import { renderStudioDocumentToHtml } from '@vibress/studio-renderer';
import { htmlToStudioDocument } from '@vibress/studio-html';
import { markdownToStudioDocument, studioDocumentToMarkdown } from '@vibress/studio-markdown';
import { LexicalEditor } from 'lexical';
import {
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
} from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import { $createHeadingNode } from '@lexical/rich-text';
import { $createListNode } from '@lexical/list';

/**
 * Test harness for Playwright E2E. Exposes:
 *  - a mock upload adapter (fail-once / fail-forever modes)
 *  - block formatting buttons (H1/H2/paragraph/lists)
 *  - import/export UI (HTML + markdown)
 *  - a `window.__studio` API for assertions
 */

declare global {
  interface Window {
    __studio: StudioTestApi;
    __studioEditor: LexicalEditor | null;
  }
}

interface StudioTestApi {
  getDoc: () => StudioDocument;
  uploads: () => StudioUploadedAsset[];
  setAdapterFailNext: (v: boolean) => void;
  setAdapterFailForever: (v: boolean) => void;
  adapterName: () => string;
  formatBlock: (type: 'h1' | 'h2' | 'paragraph' | 'bullet' | 'number') => void;
  importHTML: (html: string) => void;
  importMarkdown: (md: string) => void;
  exportMarkdown: () => string;
}

class MockUploadAdapter implements StudioUploadAdapter {
  readonly name = 'mock';
  failNext = false;
  failForever = false;
  latency = 120;
  private counter = 0;
  private recorded: StudioUploadedAsset[] = [];

  getUploads(): StudioUploadedAsset[] {
    return [...this.recorded];
  }

  async upload(
    file: File,
    context: StudioUploadContext,
    handlers?: StudioUploadHandlers
  ): Promise<StudioUploadedAsset> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('MOCK_UPLOAD_FAILED');
    }
    if (this.failForever) {
      throw new Error('MOCK_UPLOAD_FAILED');
    }
    await new Promise((resolve) => setTimeout(resolve, this.latency));
    handlers?.onProgress?.({ loaded: file.size, total: file.size, percent: 100 });
    this.counter += 1;
    const asset: StudioUploadedAsset = {
      id: `mock-${this.counter}`,
      url: `mock://asset/${this.counter}`,
      mimeType: file.type || context.mimeType,
      size: file.size,
      alt: file.name,
    };
    this.recorded.push(asset);
    return asset;
  }
}

export function E2EHarness() {
  const [doc, setDoc] = useState<StudioDocument>(createEmptyStudioDocument());
  const [editor, setEditor] = useState<LexicalEditor | null>(null);
  const [htmlInput, setHtmlInput] = useState('');
  const [mdInput, setMdInput] = useState('');
  const [mdOutput, setMdOutput] = useState('');
  const [previewTab, setPreviewTab] = useState<'html' | 'json'>('html');
  const adapterRef = useRef<MockUploadAdapter | null>(null);
  if (!adapterRef.current) adapterRef.current = new MockUploadAdapter();

  const htmlOutput = useMemo(() => renderStudioDocumentToHtml(doc), [doc]);

  const formatBlock = useCallback(
    (type: 'h1' | 'h2' | 'paragraph' | 'bullet' | 'number') => {
      if (!editor) return;
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;
        if (type === 'h1' || type === 'h2') {
          $setBlocksType(selection, () => $createHeadingNode(type));
        } else if (type === 'paragraph') {
          $setBlocksType(selection, () => $createParagraphNode());
        } else if (type === 'bullet') {
          $setBlocksType(selection, () => $createListNode('bullet', 1));
        } else if (type === 'number') {
          $setBlocksType(selection, () => $createListNode('number', 1));
        }
      });
    },
    [editor]
  );

  const api = useMemo<StudioTestApi>(
    () => ({
      getDoc: () => doc,
      uploads: () => adapterRef.current?.getUploads() ?? [],
      setAdapterFailNext: (v) => {
        if (adapterRef.current) adapterRef.current.failNext = v;
      },
      setAdapterFailForever: (v) => {
        if (adapterRef.current) adapterRef.current.failForever = v;
      },
      adapterName: () => adapterRef.current?.name ?? 'none',
      formatBlock,
      importHTML: (html) => setDoc(htmlToStudioDocument(html)),
      importMarkdown: (md) => setDoc(markdownToStudioDocument(md)),
      exportMarkdown: () => {
        const out = studioDocumentToMarkdown(doc);
        setMdOutput(out);
        return out;
      },
    }),
    [doc, formatBlock]
  );

  useEffect(() => {
    window.__studio = api;
    window.__studioEditor = editor;
  }, [api, editor]);

  const btn = {
    padding: '8px 12px',
    background: '#1d4ed8', // AA contrast on white
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  } as const;

  const label = { fontSize: '12px', fontWeight: 600, color: '#374151', margin: '12px 0 4px', display: 'block' } as const;

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ fontSize: '22px', margin: '0 0 4px', color: '#111827' }}>Vibress Studio E2E Harness</h1>
      <p style={{ fontSize: '14px', margin: '0 0 16px', color: '#4b5563' }}>
        Playwright test bed — controlled editor with mock upload adapter and import/export.
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }} role="toolbar" aria-label="Block formatting">
        <button type="button" data-testid="fmt-h1" style={btn} onClick={() => formatBlock('h1')}>Heading 1</button>
        <button type="button" data-testid="fmt-h2" style={btn} onClick={() => formatBlock('h2')}>Heading 2</button>
        <button type="button" data-testid="fmt-para" style={btn} onClick={() => formatBlock('paragraph')}>Paragraph</button>
        <button type="button" data-testid="fmt-bullet" style={btn} onClick={() => formatBlock('bullet')}>Bullet list</button>
        <button type="button" data-testid="fmt-number" style={btn} onClick={() => formatBlock('number')}>Numbered list</button>
        <button
          type="button"
          data-testid="btn-reset"
          style={{ ...btn, background: '#6b7280' }}
          onClick={() => setDoc(createEmptyStudioDocument())}
        >
          Reset
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <section>
          <h2 style={{ fontSize: '16px', margin: '0 0 8px', color: '#1f2937' }}>Editor</h2>
          <div data-testid="studio-editor">
            <VibressStudio
              value={doc}
              onChange={(d) => setDoc(d)}
              placeholder="Type here..."
              uploadAdapter={adapterRef.current}
              onEditorReady={setEditor}
            />
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: '16px', margin: '0 0 8px', color: '#1f2937' }}>Preview</h2>
          <div role="tablist" aria-label="Preview type" style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
            {(['html', 'json'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={previewTab === tab}
                data-testid={`tab-${tab}`}
                style={{
                  padding: '6px 14px',
                  background: previewTab === tab ? '#1d4ed8' : '#e5e7eb',
                  color: previewTab === tab ? '#ffffff' : '#374151',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
                onClick={() => setPreviewTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
          <div
            data-testid="preview"
            style={{
              background: '#ffffff',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              padding: '12px',
              minHeight: '200px',
              maxHeight: '420px',
              overflowY: 'auto',
            }}
          >
            {previewTab === 'html' ? (
              <SafeHtml html={sanitizeToSafeHtml(htmlOutput)} data-testid="preview-html" />
            ) : (
              <pre data-testid="preview-json" style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(doc, null, 1)}
              </pre>
            )}
          </div>
        </section>
      </div>

      <section style={{ marginTop: '24px' }}>
        <h2 style={{ fontSize: '16px', margin: '0 0 8px', color: '#1f2937' }}>Import / Export</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style={label} htmlFor="import-html-input">HTML to import</label>
            <textarea
              id="import-html-input"
              data-testid="import-html-input"
              value={htmlInput}
              onChange={(e) => setHtmlInput(e.target.value)}
              rows={4}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '4px', padding: '8px', fontSize: '12px', fontFamily: 'monospace' }}
            />
            <button
              type="button"
              data-testid="import-html-btn"
              style={{ ...btn, marginTop: '8px' }}
              onClick={() => setDoc(htmlToStudioDocument(htmlInput))}
            >
              Import HTML
            </button>
          </div>
          <div>
            <label style={label} htmlFor="import-md-input">Markdown to import</label>
            <textarea
              id="import-md-input"
              data-testid="import-md-input"
              value={mdInput}
              onChange={(e) => setMdInput(e.target.value)}
              rows={4}
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: '4px', padding: '8px', fontSize: '12px', fontFamily: 'monospace' }}
            />
            <button
              type="button"
              data-testid="import-md-btn"
              style={{ ...btn, marginTop: '8px' }}
              onClick={() => setDoc(markdownToStudioDocument(mdInput))}
            >
              Import Markdown
            </button>
          </div>
        </div>
        <div style={{ marginTop: '12px' }}>
          <button
            type="button"
            data-testid="export-md-btn"
            style={{ ...btn, background: '#065f46' }}
            onClick={() => {
              const out = studioDocumentToMarkdown(doc);
              setMdOutput(out);
            }}
          >
            Export Markdown
          </button>
          <label style={label} htmlFor="export-md-output">Markdown export</label>
          <textarea
            id="export-md-output"
            data-testid="export-md-output"
            readOnly
            value={mdOutput}
            rows={4}
            style={{ width: '100%', marginTop: '8px', border: '1px solid #d1d5db', borderRadius: '4px', padding: '8px', fontSize: '12px', fontFamily: 'monospace' }}
          />
        </div>
      </section>
    </div>
  );
}
