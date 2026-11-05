import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { VibressStudio, type StudioRecoveryData } from '@vibress/studio-react';
import { sanitizeStudioHtml } from '@vibress/studio-utils';
import { StudioDocument, createEmptyStudioDocument } from '@vibress/studio-core';
import { renderStudioDocumentToHtml } from '@vibress/studio-renderer';
import { htmlToStudioDocument } from '@vibress/studio-html';
import { createBenchmarkStudioDocument } from '@vibress/studio-testing';
import { parseMarkdownToHtml, studioDocumentToMarkdown } from '@vibress/studio-markdown';
import { LexicalEditor } from 'lexical';
import {
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  $getRoot,
  $isElementNode,
  type LexicalNode,
} from 'lexical';
import { StudioCardNode } from '@vibress/studio-cards';
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

interface StudioUploadedAsset {
  id: string;
  url: string;
  mimeType: string;
  size: number;
  alt?: string;
}

interface StudioTestApi {
  getDoc: () => StudioDocument;
  uploads: () => StudioUploadedAsset[];
  setAdapterFailNext: (v: boolean) => void;
  setAdapterFailForever: (v: boolean) => void;
  setAdapterLatency: (ms: number) => void;
  setCardField: (cardType: string, field: string, value: string) => void;
  setPickerEnabled: (value: boolean) => void;
  setPickerFailNext: (value: boolean) => void;
  adapterName: () => string;
  formatBlock: (type: 'h1' | 'h2' | 'paragraph' | 'bullet' | 'number') => void;
  importHTML: (html: string) => void;
  importMarkdown: (md: string) => void;
  /** Update value without remounting Lexical, to exercise controlled props. */
  syncHTML: (html: string) => void;
  /** Fault-inject raw host input while keeping the last valid preview document. */
  syncValue: (value: unknown) => void;
  benchmarkReadyMs: () => number | null;
  setRecoveryLocale: (locale: 'en' | 'ar') => void;
  setReadOnly: (value: boolean) => void;
  setAiEnabled: (value: boolean) => void;
  setRtl: (value: boolean) => void;
  exportMarkdown: () => string;
}

class MockUploadAdapter {
  readonly name = 'mock';
  failNext = false;
  failForever = false;
  latency = 120;
  private counter = 0;
  private recorded: StudioUploadedAsset[] = [];

  getUploads(): StudioUploadedAsset[] {
    return [...this.recorded];
  }

  async upload(file: File, _cardType: string): Promise<Record<string, unknown> | null> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('MOCK_UPLOAD_FAILED');
    }
    if (this.failForever) {
      throw new Error('MOCK_UPLOAD_FAILED');
    }
    await new Promise((resolve) => setTimeout(resolve, this.latency));
    this.counter += 1;
    const id = `mock-${this.counter}`;
    const url = `/mock/assets/${this.counter}`;
    const asset: StudioUploadedAsset = {
      id,
      url,
      mimeType: file.type,
      size: file.size,
      alt: file.name,
    };
    this.recorded.push(asset);
    return { assetId: id, src: url, alt: file.name };
  }
}

export function E2EHarness() {
  const [mountStartedAt] = useState(() => performance.now());
  const readyMs = useRef<number | null>(null);
  const readyFrame = useRef<number | null>(null);
  const [doc, setDoc] = useState<StudioDocument>(() => {
    const benchmark = new URLSearchParams(window.location.search).get('benchmark');
    return benchmark ? createBenchmarkStudioDocument(benchmark) : createEmptyStudioDocument();
  });
  const [externalValue, setExternalValue] = useState<{ value: unknown } | null>(null);
  const [recoveryLocale, setRecoveryLocale] = useState<'en' | 'ar'>('en');
  const exportRecovery = useCallback((data: StudioRecoveryData) => {
    const json = JSON.stringify({ ...data, error: { name: data.error.name, message: data.error.message } }, null, 2);
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'studio-recovery.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }, []);
  const [replacementId, setReplacementId] = useState(0);
  const [readOnly, setReadOnly] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [pickerEnabled, setPickerEnabled] = useState(false);
  const pickerFailNextRef = useRef(false);
  const replaceDoc = useCallback((next: StudioDocument) => {
    // Explicit import/reset: replace the live document without destroying the
    // mounted Lexical editor or its host callback subscriptions.
    setDoc(next);
    setExternalValue(null);
    setReplacementId((value) => value + 1);
  }, []);
  const uploadMedia = useCallback((file: File, cardType: string) =>
    adapterRef.current?.upload(file, cardType) ?? Promise.resolve(null), []);
  const requestMedia = useCallback(async (_request: { cardType: string }) => {
    await new Promise(resolve => setTimeout(resolve, 180));
    if (pickerFailNextRef.current) {
      pickerFailNextRef.current = false;
      throw new Error('MOCK_PICKER_FAILED');
    }
    return { assetId: 'picker-mock', src: '/mock/assets/from-picker' };
  }, []);
  const [editor, setEditor] = useState<LexicalEditor | null>(null);
  const handleEditorReady = useCallback((instance: LexicalEditor | null) => {
    setEditor(instance);
    if (!instance) {
      if (readyFrame.current !== null) cancelAnimationFrame(readyFrame.current);
      return;
    }
    readyFrame.current = requestAnimationFrame(() => {
      readyFrame.current = requestAnimationFrame(() => {
        readyFrame.current = null;
        readyMs.current = performance.now() - mountStartedAt;
      });
    });
  }, [mountStartedAt]);
  const [isRtl, setIsRtl] = useState(false);
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

  const setCardField = useCallback((cardType: string, field: string, value: string) => {
    if (!editor) return;
    editor.update(() => {
      const visit = (node: LexicalNode): boolean => {
        if (node instanceof StudioCardNode && node.getCardType() === cardType) {
          node.setCardData({ ...node.getCardData(), [field]: value });
          return true;
        }
        if ($isElementNode(node)) {
          for (const child of node.getChildren()) {
            if (visit(child)) return true;
          }
        }
        return false;
      };
      visit($getRoot());
    });
  }, [editor]);

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
      setAdapterLatency: (ms) => {
        if (adapterRef.current) adapterRef.current.latency = ms;
      },
      setCardField,
      setPickerEnabled,
      setPickerFailNext: (value) => { pickerFailNextRef.current = value; },
      adapterName: () => adapterRef.current?.name ?? 'none',
      formatBlock,
      importHTML: (html) => replaceDoc(htmlToStudioDocument(html)),
      importMarkdown: (md) => replaceDoc(htmlToStudioDocument(parseMarkdownToHtml(md))),
      syncHTML: (html) => setDoc(htmlToStudioDocument(html)),
      syncValue: (value) => setExternalValue({ value }),
      benchmarkReadyMs: () => readyMs.current,
      setRecoveryLocale,
      setReadOnly,
      setAiEnabled,
      setRtl: (rtl: boolean) => setIsRtl(rtl),
      exportMarkdown: () => {
        const out = studioDocumentToMarkdown(doc);
        setMdOutput(out);
        return out;
      },
    }),
    [doc, formatBlock, replaceDoc, setCardField]
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
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '12px' }}>
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
          data-testid="btn-toggle-rtl"
          style={{ ...btn, background: '#4f46e5' }}
          onClick={() => setIsRtl(!isRtl)}
        >
          {isRtl ? 'RTL Active' : 'Toggle RTL'}
        </button>
        <button
          type="button"
          data-testid="btn-reset"
          style={{ ...btn, background: '#6b7280' }}
          onClick={() => replaceDoc(createEmptyStudioDocument())}
        >
          Reset
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
        <section>
          <h2 style={{ fontSize: '16px', margin: '0 0 8px', color: '#1f2937' }}>Editor</h2>
          <div data-testid="studio-editor" data-ai-enabled={aiEnabled}>
            <VibressStudio
              value={externalValue ? externalValue.value : doc}
              recoveryLocale={recoveryLocale}
              onRequestRecovery={exportRecovery}
              replacementId={replacementId}
              onChange={(d) => setDoc(d)}
              readOnly={readOnly}
              enableAi={aiEnabled}
              onAiGenerate={async (prompt) => `Mock AI response: ${prompt}`}
              placeholder="Type here..."
              uploadMedia={uploadMedia}
              requestMedia={pickerEnabled ? requestMedia : undefined}
              onEditorReady={handleEditorReady}
              dir={isRtl ? 'rtl' : 'ltr'}
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
              <div data-testid="preview-html" dangerouslySetInnerHTML={{ __html: sanitizeStudioHtml(htmlOutput) }} />
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div>
            <label style={label} htmlFor="import-html-input">HTML to import</label>
            <textarea
              id="import-html-input"
              data-testid="import-html-input"
              value={htmlInput}
              onChange={(e) => setHtmlInput(e.target.value)}
              rows={4}
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '4px', padding: '8px', fontSize: '12px', fontFamily: 'monospace' }}
            />
            <button
              type="button"
              data-testid="import-html-btn"
              style={{ ...btn, marginTop: '8px' }}
              onClick={() => replaceDoc(htmlToStudioDocument(htmlInput))}
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
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #d1d5db', borderRadius: '4px', padding: '8px', fontSize: '12px', fontFamily: 'monospace' }}
            />
            <button
              type="button"
              data-testid="import-md-btn"
              style={{ ...btn, marginTop: '8px' }}
              onClick={() => replaceDoc(htmlToStudioDocument(parseMarkdownToHtml(mdInput)))}
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
            style={{ width: '100%', boxSizing: 'border-box', marginTop: '8px', border: '1px solid #d1d5db', borderRadius: '4px', padding: '8px', fontSize: '12px', fontFamily: 'monospace' }}
          />
        </div>
      </section>
    </div>
  );
}
