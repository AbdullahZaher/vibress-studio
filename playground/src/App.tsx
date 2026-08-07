import React, { useState } from 'react';
import { VibressStudio } from '@vibress/studio-react';
import { StudioDocument, createEmptyStudioDocument } from '@vibress/studio-core';
import { renderStudioDocumentToHtml, renderStudioDocumentToPlainText } from '@vibress/studio-renderer';
import { studioDocumentToMarkdown } from '@vibress/studio-markdown';
import { createTestStudioDocument, createStressTestStudioDocument } from '@vibress/studio-testing';

export default function App() {
  const [doc, setDoc] = useState<StudioDocument>(createTestStudioDocument());
  const [activeTab, setActiveTab] = useState<'html' | 'json' | 'markdown' | 'text'>('html');

  const htmlOutput = renderStudioDocumentToHtml(doc);
  const markdownOutput = studioDocumentToMarkdown(doc);
  const textOutput = renderStudioDocumentToPlainText(doc);

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '24px', color: '#0f172a' }}>Vibress Studio Playground</h1>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
            Standalone Lexical-based editor testbed (Independent of Vibress Core)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setDoc(createTestStudioDocument())}
            style={{ padding: '8px 12px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Load Sample Doc
          </button>
          <button
            onClick={() => setDoc(createStressTestStudioDocument(100))}
            style={{ padding: '8px 12px', background: '#8b5cf6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Stress Test (100 P)
          </button>
          <button
            onClick={() => setDoc(createEmptyStudioDocument())}
            style={{ padding: '8px 12px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Reset
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Left Column: Vibress Studio Editor */}
        <div>
          <h2 style={{ fontSize: '16px', color: '#334155', marginBottom: '8px' }}>Editor Input</h2>
          <VibressStudio value={doc} onChange={(newDoc) => setDoc(newDoc)} placeholder="Type here..." />
        </div>

        {/* Right Column: Output Preview Tabs */}
        <div>
          <div style={{ display: 'flex', borderBottom: '1px solid #cbd5e1', marginBottom: '12px' }}>
            {(['html', 'json', 'markdown', 'text'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
                  color: activeTab === tab ? '#3b82f6' : '#64748b',
                  fontWeight: activeTab === tab ? 'bold' : 'normal',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  fontSize: '12px',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '16px', minHeight: '300px', maxHeight: '500px', overflowY: 'auto' }}>
            {activeTab === 'html' && (
              <div>
                <h3 style={{ fontSize: '14px', margin: '0 0 12px', color: '#64748b' }}>Rendered HTML Preview:</h3>
                <div dangerouslySetInnerHTML={{ __html: htmlOutput }} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fafafa' }} />
                <h3 style={{ fontSize: '14px', margin: '16px 0 8px', color: '#64748b' }}>Raw HTML Code:</h3>
                <pre style={{ margin: 0, padding: '12px', background: '#0f172a', color: '#f8fafc', borderRadius: '4px', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                  {htmlOutput}
                </pre>
              </div>
            )}

            {activeTab === 'json' && (
              <pre style={{ margin: 0, padding: '12px', background: '#0f172a', color: '#38bdf8', borderRadius: '4px', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(doc, null, 2)}
              </pre>
            )}

            {activeTab === 'markdown' && (
              <pre style={{ margin: 0, padding: '12px', background: '#0f172a', color: '#f8fafc', borderRadius: '4px', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
                {markdownOutput}
              </pre>
            )}

            {activeTab === 'text' && (
              <pre style={{ margin: 0, padding: '12px', background: '#f8fafc', color: '#334155', borderRadius: '4px', fontSize: '13px', whiteSpace: 'pre-wrap' }}>
                {textOutput}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
