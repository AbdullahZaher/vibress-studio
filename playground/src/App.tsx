import React, { useState, useEffect } from 'react';
import { VibressStudio, UnsplashIcon } from '@vibress/studio-react';
import { StudioDocument, createEmptyStudioDocument } from '@vibress/studio-core';
import { renderStudioDocumentToHtml, renderStudioDocumentToPlainText } from '@vibress/studio-renderer';
import { studioDocumentToMarkdown } from '@vibress/studio-markdown';
import { createTestStudioDocument, createStressTestStudioDocument } from '@vibress/studio-testing';
import {
  ChevronLeft,
  CheckCircle2,
  Eye,
  PanelRight,
  SlidersHorizontal,
  Plus,
  Moon,
  Sun,
  Languages,
  ImageIcon,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  List,
  ListOrdered,
  CheckSquare,
  Table,
  Minus,
  Film,
  Music,
  FileText,
  Bookmark,
  Share2,
  MessageSquare,
  X,
} from 'lucide-react';

export default function App() {
  const [doc, setDoc] = useState<StudioDocument>(createTestStudioDocument());
  const [title, setTitle] = useState('');
  const [featureImage, setFeatureImage] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showInserter, setShowInserter] = useState(false);
  const [isDark, setIsDark] = useState(true);
  const [isRtl, setIsRtl] = useState(false);
  const [searchBlockQuery, setSearchBlockQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'html' | 'json' | 'markdown' | 'text'>('html');
  const [savedStatus, setSavedStatus] = useState<'Saved' | 'Saving...'>('Saved');

  // Post settings state (Ghost parity)
  const [postUrl, setPostUrl] = useState('the-double-edged-sword-of-independence');
  const [publishDate, setPublishDate] = useState('2026-11-04 18:45 UTC');
  const [postAccess, setPostAccess] = useState<'Public' | 'Members only' | 'Paid members'>('Public');
  const [excerpt, setExcerpt] = useState('As an independent creator, you get access to freedom and control, but also gain all the responsibility.');
  const [isFeatured, setIsFeatured] = useState(false);
  const [tags, setTags] = useState(['Newsletter', 'Creator Economy', 'Vibress Studio']);
  const [authors] = useState(['Abdullah Zaher']);

  // Sync dark mode class and direction on document root
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.removeAttribute('data-theme');
    }
  }, [isDark]);

  useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
  }, [isRtl]);

  const handleDocChange = (newDoc: StudioDocument) => {
    setSavedStatus('Saving...');
    setDoc(newDoc);
    setTimeout(() => setSavedStatus('Saved'), 350);
  };

  const htmlOutput = renderStudioDocumentToHtml(doc);
  const markdownOutput = studioDocumentToMarkdown(doc);
  const textOutput = renderStudioDocumentToPlainText(doc);

  // Inserter blocks catalog (Gutenberg parity)
  const INSERTER_BLOCKS = [
    { title: 'Text', category: 'Text', icon: <FileText size={16} />, hint: 'Paragraph text' },
    { title: 'Heading 1', category: 'Text', icon: <Heading1 size={16} />, hint: 'Large section heading' },
    { title: 'Heading 2', category: 'Text', icon: <Heading2 size={16} />, hint: 'Medium section heading' },
    { title: 'Heading 3', category: 'Text', icon: <Heading3 size={16} />, hint: 'Small section heading' },
    { title: 'Quote', category: 'Text', icon: <Quote size={16} />, hint: 'Blockquote callout' },
    { title: 'Code Block', category: 'Text', icon: <Code size={16} />, hint: 'Syntax highlighted code' },
    { title: 'Table', category: 'Structure', icon: <Table size={16} />, hint: '3x3 grid table' },
    { title: 'Bulleted list', category: 'Lists', icon: <List size={16} />, hint: 'Bulleted list' },
    { title: 'Numbered list', category: 'Lists', icon: <ListOrdered size={16} />, hint: 'Ordered sequence' },
    { title: 'To-do list', category: 'Lists', icon: <CheckSquare size={16} />, hint: 'Checklist with boxes' },
    { title: 'Divider', category: 'Structure', icon: <Minus size={16} />, hint: 'Horizontal separator' },
    { title: 'Image', category: 'Media', icon: <ImageIcon size={16} />, hint: 'Single photo with caption' },
    { title: 'Gallery', category: 'Media', icon: <ImageIcon size={16} />, hint: 'Grid of images' },
    { title: 'Video', category: 'Media', icon: <Film size={16} />, hint: 'Video player embed' },
    { title: 'Audio', category: 'Media', icon: <Music size={16} />, hint: 'Audio track player' },
    { title: 'File', category: 'Media', icon: <FileText size={16} />, hint: 'Downloadable attachment' },
    { title: 'Bookmark', category: 'Embed', icon: <Bookmark size={16} />, hint: 'URL preview card' },
    { title: 'Embed', category: 'Embed', icon: <Share2 size={16} />, hint: 'YouTube, Spotify, Twitter' },
    { title: 'Callout', category: 'Interactive', icon: <MessageSquare size={16} />, hint: 'Visual note callout' },
  ];

  const filteredBlocks = INSERTER_BLOCKS.filter(
    (b) =>
      b.title.toLowerCase().includes(searchBlockQuery.toLowerCase()) ||
      b.category.toLowerCase().includes(searchBlockQuery.toLowerCase()) ||
      b.hint.toLowerCase().includes(searchBlockQuery.toLowerCase())
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--vb-studio-canvas, #ffffff)',
        color: 'var(--vb-studio-foreground, #0f172a)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 1. Ghost & Gutenberg-Style Editorial Top Bar */}
      <header
        style={{
          height: '64px',
          padding: '0 40px',
          borderBottom: '1px solid var(--vb-studio-border, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--vb-studio-surface, #ffffff)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Left: Breadcrumbs & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            type="button"
            style={{
              background: 'none',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              color: 'var(--vb-studio-foreground-muted, #64748b)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              padding: 0,
            }}
          >
            <ChevronLeft size={16} />
            <span>Posts</span>
          </button>

          <span style={{ color: 'var(--vb-studio-border, #e2e8f0)' }}>|</span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--vb-studio-foreground-muted, #64748b)' }}>
            <CheckCircle2 size={14} color="#10b981" />
            <span>Draft — {savedStatus}</span>
          </div>

          {/* Quick Gutenberg Inserter Toggle */}
          <button
            type="button"
            onClick={() => setShowInserter(!showInserter)}
            title="Toggle Gutenberg-style block inserter drawer"
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: showInserter ? '1px solid var(--vb-studio-primary)' : '1px solid var(--vb-studio-border, #e2e8f0)',
              background: showInserter ? 'var(--vb-studio-surface-muted, #f1f5f9)' : 'transparent',
              color: 'var(--vb-studio-foreground, #0f172a)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <Plus size={15} />
            <span>Blocks</span>
          </button>
        </div>

        {/* Right: Actions, Modes & Settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* RTL Toggle */}
          <button
            type="button"
            onClick={() => setIsRtl(!isRtl)}
            title="Toggle RTL / LTR direction"
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid var(--vb-studio-border, #e2e8f0)',
              background: isRtl ? 'var(--vb-studio-surface-muted, #f1f5f9)' : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--vb-studio-foreground, #0f172a)',
            }}
          >
            <Languages size={15} />
            <span>{isRtl ? 'العربية (RTL)' : 'English (LTR)'}</span>
          </button>

          {/* Dark Mode Toggle */}
          <button
            type="button"
            onClick={() => setIsDark(!isDark)}
            title="Toggle Light / Dark mode"
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid var(--vb-studio-border, #e2e8f0)',
              background: 'transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              color: 'var(--vb-studio-foreground, #0f172a)',
            }}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Preview Toggle */}
          <button
            type="button"
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid var(--vb-studio-border, #e2e8f0)',
              background: isPreviewMode ? 'var(--vb-studio-surface-muted, #f1f5f9)' : 'transparent',
              color: 'var(--vb-studio-foreground, #0f172a)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            <Eye size={15} />
            <span>{isPreviewMode ? 'Editor' : 'Preview'}</span>
          </button>

          {/* Publish / Save Button (Ghost Variant) */}
          <button
            type="button"
            onClick={() => alert('Post saved successfully in Vibress Studio!')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: 'var(--vb-studio-foreground-muted, #64748b)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--vb-studio-foreground, #0f172a)';
              e.currentTarget.style.backgroundColor = 'var(--vb-studio-surface-muted, rgba(255, 255, 255, 0.06))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--vb-studio-foreground-muted, #64748b)';
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            Save Draft
          </button>

          {/* Ghost Settings Toggle */}
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            title="Toggle Post Settings Sidebar"
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              border: '1px solid var(--vb-studio-border, #e2e8f0)',
              background: showSettings ? 'var(--vb-studio-surface-muted, #f1f5f9)' : 'transparent',
              color: 'var(--vb-studio-foreground, #0f172a)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <PanelRight size={16} />
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div style={{ display: 'flex', flex: 1, position: 'relative', overflow: 'hidden' }}>
        {/* 2. Gutenberg-Style Left Inserter Drawer */}
        {showInserter && (
          <aside
            style={{
              width: '300px',
              borderInlineEnd: '1px solid var(--vb-studio-border, #e2e8f0)',
              backgroundColor: 'var(--vb-studio-surface, #ffffff)',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              zIndex: 90,
            }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--vb-studio-border, #e2e8f0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--vb-studio-foreground-muted)' }}>
                Blocks & Cards
              </span>
              <button
                type="button"
                onClick={() => setShowInserter(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--vb-studio-foreground-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: '12px 16px' }}>
              <input
                type="text"
                placeholder="Search blocks..."
                value={searchBlockQuery}
                onChange={(e) => setSearchBlockQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--vb-studio-border, #e2e8f0)',
                  backgroundColor: 'var(--vb-studio-canvas, #ffffff)',
                  color: 'var(--vb-studio-foreground)',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                {filteredBlocks.map((b) => (
                  <button
                    key={b.title}
                    type="button"
                    onClick={() => {
                      alert(`Type "/${b.title.toLowerCase()}" in the editor to insert this block!`);
                    }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '12px 8px',
                      borderRadius: '8px',
                      border: '1px solid var(--vb-studio-border, #e2e8f0)',
                      backgroundColor: 'var(--vb-studio-surface, #ffffff)',
                      color: 'var(--vb-studio-foreground)',
                      cursor: 'pointer',
                      gap: '8px',
                      textAlign: 'center',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--vb-studio-surface-muted, #f1f5f9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {b.icon}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>{b.title}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* 3. Ghost-Style Editorial Canvas */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '64px 40px 180px',
            position: 'relative',
            backgroundColor: 'var(--vb-studio-canvas, #ffffff)',
          }}
        >
          <div style={{ maxWidth: '760px', margin: '0 auto', position: 'relative' }}>
            {isPreviewMode ? (
              /* Published Ghost Article View */
              <article style={{ lineHeight: '1.8' }}>
                {featureImage && (
                  <img
                    src={featureImage}
                    alt={title}
                    style={{ width: '100%', maxHeight: '420px', objectFit: 'cover', borderRadius: '12px', marginBottom: '28px' }}
                  />
                )}
                <h1 style={{ fontSize: '2.5rem', fontWeight: 800, lineHeight: 1.25, marginBottom: '16px', letterSpacing: '-0.025em' }}>
                  {title}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px', color: 'var(--vb-studio-foreground-muted)', fontSize: '14px' }}>
                  <span>{authors.join(', ')}</span>
                  <span>·</span>
                  <span>{publishDate}</span>
                  <span>·</span>
                  <span style={{ display: 'flex', gap: '4px' }}>
                    {tags.map((t) => (
                      <span key={t} style={{ background: '#fce7f3', color: '#be185d', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                        {t}
                      </span>
                    ))}
                  </span>
                </div>
                <div
                  className="studio-rendered-html-preview"
                  dangerouslySetInnerHTML={{ __html: htmlOutput }}
                />
              </article>
            ) : (
              /* Ghost-Style Editorial Writing Surface */
              <>
                {/* Feature Image Header Affordance */}
                <div style={{ marginBottom: '28px' }}>
                  {featureImage ? (
                    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
                      <img src={featureImage} alt="Feature" style={{ width: '100%', maxHeight: '360px', objectFit: 'cover' }} />
                      <button
                        type="button"
                        onClick={() => setFeatureImage(null)}
                        style={{
                          position: 'absolute',
                          top: '12px',
                          insetInlineEnd: '12px',
                          background: 'rgba(0,0,0,0.6)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '6px 10px',
                          cursor: 'pointer',
                          fontSize: '12px',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() =>
                          setFeatureImage(
                            'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=80'
                          )
                        }
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 0',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--vb-studio-foreground-muted, #64748b)',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 500,
                        }}
                      >
                        <span style={{ fontSize: '15px', lineHeight: 1 }}>+</span>
                        <span>Add feature image</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFeatureImage(
                            'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=80'
                          )
                        }
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          height: '24px',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--vb-studio-foreground-muted, #64748b)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                        title="Add image from library"
                      >
                        <ImageIcon size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setFeatureImage(
                            'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1200&q=80'
                          )
                        }
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          height: '24px',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--vb-studio-foreground-muted, #64748b)',
                          cursor: 'pointer',
                          padding: 0,
                        }}
                        title="Add image from Unsplash"
                      >
                        <UnsplashIcon size={14} />
                      </button>
                    </div>
                  )}
                </div>

                {/* Article Title Input (Ghost Gold Standard) */}
                <textarea
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Post title"
                  rows={1}
                  style={{
                    width: '100%',
                    border: 'none',
                    outline: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--vb-studio-foreground, #0f172a)',
                    fontSize: '3rem',
                    fontWeight: 800,
                    lineHeight: 1.2,
                    marginBottom: '28px',
                    letterSpacing: '-0.025em',
                    resize: 'none',
                    fontFamily: 'inherit',
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                />

                {/* Vibress Studio Full Editor */}
                <VibressStudio
                  value={doc}
                  onChange={handleDocChange}
                  placeholder="Begin writing your post..."
                  showWordCount={true}
                />
              </>
            )}
          </div>
        </main>

        {/* 4. Ghost-Style Post Settings Sidebar */}
        {showSettings && (
          <aside
            style={{
              width: '320px',
              borderInlineStart: '1px solid var(--vb-studio-border, #e2e8f0)',
              backgroundColor: 'var(--vb-studio-surface, #ffffff)',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              overflowY: 'auto',
              padding: '20px',
              zIndex: 90,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>Post settings</h3>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--vb-studio-foreground-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Post URL */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--vb-studio-foreground-muted)', marginBottom: '6px' }}>
                Post URL
              </label>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--vb-studio-border, #e2e8f0)',
                  backgroundColor: 'var(--vb-studio-canvas, #ffffff)',
                  fontSize: '13px',
                }}
              >
                <input
                  type="text"
                  value={postUrl}
                  onChange={(e) => setPostUrl(e.target.value)}
                  style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', color: 'var(--vb-studio-foreground)', fontSize: '13px' }}
                />
              </div>
            </div>

            {/* Publish Date */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--vb-studio-foreground-muted)', marginBottom: '6px' }}>
                Publish date
              </label>
              <input
                type="text"
                value={publishDate}
                onChange={(e) => setPublishDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--vb-studio-border, #e2e8f0)',
                  backgroundColor: 'var(--vb-studio-canvas, #ffffff)',
                  color: 'var(--vb-studio-foreground)',
                  fontSize: '13px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Tags */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--vb-studio-foreground-muted)', marginBottom: '6px' }}>
                Tags
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {tags.map((tag) => (
                  <span
                    key={tag}
                    style={{
                      background: '#fce7f3',
                      color: '#be185d',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>{tag}</span>
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#be185d', fontSize: '10px' }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Post Access */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--vb-studio-foreground-muted)', marginBottom: '6px' }}>
                Post access
              </label>
              <select
                value={postAccess}
                onChange={(e) => setPostAccess(e.target.value as 'Public' | 'Members only' | 'Paid members')}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--vb-studio-border, #e2e8f0)',
                  backgroundColor: 'var(--vb-studio-canvas, #ffffff)',
                  color: 'var(--vb-studio-foreground)',
                  fontSize: '13px',
                }}
              >
                <option value="Public">Public</option>
                <option value="Members only">Members only</option>
                <option value="Paid members">Paid tiers</option>
              </select>
            </div>

            {/* Excerpt */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--vb-studio-foreground-muted)', marginBottom: '6px' }}>
                Excerpt
              </label>
              <textarea
                rows={3}
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  border: '1px solid var(--vb-studio-border, #e2e8f0)',
                  backgroundColor: 'var(--vb-studio-canvas, #ffffff)',
                  color: 'var(--vb-studio-foreground)',
                  fontSize: '13px',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Authors */}
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--vb-studio-foreground-muted)', marginBottom: '6px' }}>
                Authors
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {authors.map((author) => (
                  <span
                    key={author}
                    style={{
                      background: 'var(--vb-studio-surface-muted, #f1f5f9)',
                      color: 'var(--vb-studio-foreground)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                    }}
                  >
                    {author}
                  </span>
                ))}
              </div>
            </div>

            {/* Feature this post toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid var(--vb-studio-border, #e2e8f0)' }}>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>Feature this post</span>
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
            </div>

            {/* Quick Actions */}
            <div style={{ marginTop: 'auto', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setDoc(createTestStudioDocument())}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--vb-studio-border, #e2e8f0)',
                  background: 'transparent',
                  color: 'var(--vb-studio-foreground)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                Load Sample Article
              </button>
              <button
                type="button"
                onClick={() => setDoc(createStressTestStudioDocument(100))}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--vb-studio-border, #e2e8f0)',
                  background: 'transparent',
                  color: 'var(--vb-studio-foreground)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                Stress Test (100 Blocks)
              </button>
              <button
                type="button"
                onClick={() => setDoc(createEmptyStudioDocument())}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--vb-studio-border, #e2e8f0)',
                  background: 'transparent',
                  color: 'var(--vb-studio-danger, #ef4444)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: 500,
                }}
              >
                Clear Document
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* 5. Document Serializer & Inspector Tabs */}
      <footer
        style={{
          borderTop: '1px solid var(--vb-studio-border, #e2e8f0)',
          backgroundColor: 'var(--vb-studio-surface, #ffffff)',
          padding: '12px 20px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            {(['html', 'json', 'markdown', 'text'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '4px 10px',
                  background: activeTab === tab ? 'var(--vb-studio-surface-muted, #f1f5f9)' : 'none',
                  border: '1px solid',
                  borderColor: activeTab === tab ? 'var(--vb-studio-border, #e2e8f0)' : 'transparent',
                  borderRadius: '4px',
                  color: activeTab === tab ? 'var(--vb-studio-primary, #2563eb)' : 'var(--vb-studio-foreground-muted)',
                  fontWeight: activeTab === tab ? 600 : 400,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  fontSize: '11px',
                  letterSpacing: '0.04em',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          <span style={{ fontSize: '11px', color: 'var(--vb-studio-foreground-muted)' }}>
            Vibress Studio Engine v1.2 · Clean AST Architecture · Zero Data Loss
          </span>
        </div>

        <div style={{ maxHeight: '160px', overflowY: 'auto', borderRadius: '6px', border: '1px solid var(--vb-studio-border, #e2e8f0)' }}>
          {activeTab === 'html' && (
            <pre style={{ margin: 0, padding: '10px', background: '#0f172a', color: '#f8fafc', fontSize: '11px', whiteSpace: 'pre-wrap' }}>
              {htmlOutput}
            </pre>
          )}
          {activeTab === 'json' && (
            <pre style={{ margin: 0, padding: '10px', background: '#0f172a', color: '#38bdf8', fontSize: '11px', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(doc, null, 2)}
            </pre>
          )}
          {activeTab === 'markdown' && (
            <pre style={{ margin: 0, padding: '10px', background: '#0f172a', color: '#f8fafc', fontSize: '11px', whiteSpace: 'pre-wrap' }}>
              {markdownOutput}
            </pre>
          )}
          {activeTab === 'text' && (
            <pre style={{ margin: 0, padding: '10px', background: 'var(--vb-studio-surface-muted)', color: 'var(--vb-studio-foreground)', fontSize: '12px', whiteSpace: 'pre-wrap' }}>
              {textOutput}
            </pre>
          )}
        </div>
      </footer>
    </div>
  );
}
