import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { ParagraphNode, TextNode } from 'lexical';
import { StudioCardNode } from '@vibress/studio-cards';
import { ReactStudioCardNode } from '../nodes/ReactStudioCardNode';
import { NestedCaptionEditor } from '../components/cards/NestedCaptionEditor';
import { ImageCardEditor } from '../components/cards/ImageCardEditor';
import { GalleryCardEditor } from '../components/cards/GalleryCardEditor';
import { VideoCardEditor } from '../components/cards/VideoCardEditor';
import { AudioCardEditor } from '../components/cards/AudioCardEditor';
import { FileCardEditor } from '../components/cards/FileCardEditor';
import { EmbedCardEditor } from '../components/cards/EmbedCardEditor';

function TestWrapper({
  children,
  editable = true,
}: {
  children: React.ReactNode;
  editable?: boolean;
}) {
  const initialConfig = {
    namespace: 'TestParent',
    nodes: [ParagraphNode, TextNode, StudioCardNode, ReactStudioCardNode],
    editable,
    onError: (e: Error) => {
      console.error(e);
    },
  };
  return <LexicalComposer initialConfig={initialConfig}>{children}</LexicalComposer>;
}

describe('Stable Media Caption Editing (STU-R03, STU-R11)', () => {
  it('renders editable contenteditable surface and placeholder when editable', () => {
    const handleChange = vi.fn();
    render(
      <TestWrapper editable={true}>
        <NestedCaptionEditor
          placeholder="Type custom caption..."
          onChange={handleChange}
        />
      </TestWrapper>
    );

    const editableEl = screen.getByRole('textbox', { name: 'Type custom caption...' });
    expect(editableEl).not.toBeNull();
    expect(editableEl.getAttribute('contenteditable')).toBe('true');
    expect(screen.getByText('Type custom caption...')).not.toBeNull();
  });

  it('initializes with plain string caption without unmounting into static figcaption', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <TestWrapper editable={true}>
        <NestedCaptionEditor
          initialCaptionText="Mountain landscape in sunset"
          placeholder="Type caption..."
          onChange={handleChange}
        />
      </TestWrapper>
    );

    // Should render contenteditable containing the text, NOT an uneditable <figcaption>
    const figcaption = container.querySelector('figcaption');
    expect(figcaption).toBeNull();

    const editableEl = screen.getByRole('textbox', { name: 'Type caption...' });
    expect(editableEl).not.toBeNull();
    expect(editableEl.textContent).toBe('Mountain landscape in sunset');
  });

  it('renders semantic figcaption in read-only mode if caption exists', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <TestWrapper editable={false}>
        <NestedCaptionEditor
          initialCaptionText="ReadOnly caption"
          onChange={handleChange}
        />
      </TestWrapper>
    );

    const editableEl = screen.queryByRole('textbox');
    expect(editableEl).toBeNull();

    const figcaption = container.querySelector('figcaption');
    expect(figcaption).not.toBeNull();
    expect(figcaption?.textContent).toBe('ReadOnly caption');
  });

  it('renders null in read-only mode if caption is empty', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <TestWrapper editable={false}>
        <NestedCaptionEditor
          initialCaptionText=""
          onChange={handleChange}
        />
      </TestWrapper>
    );

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(container.querySelector('figcaption')).toBeNull();
  });

  it('sanitizes unsafe captionHtml in read-only figcaption', () => {
    const handleChange = vi.fn();
    const { container } = render(
      <TestWrapper editable={false}>
        <NestedCaptionEditor
          initialCaptionText="Fallback text"
          captionHtml="<strong>Bold Caption</strong><script>alert('xss')</script>"
          onChange={handleChange}
        />
      </TestWrapper>
    );

    const figcaption = container.querySelector('figcaption');
    expect(figcaption).not.toBeNull();
    expect(figcaption?.innerHTML).toContain('<strong>Bold Caption</strong>');
    expect(figcaption?.innerHTML).not.toContain('<script>');
  });

  it('recovers gracefully from malformed caption JSON without content loss (STU-R11)', () => {
    const handleChange = vi.fn();
    const handleError = vi.fn();

    // Malformed JSON that fails parseEditorState
    const malformedJSON = {
      root: {
        children: 'corrupted-children-not-array',
        type: 'root',
        version: 1,
      },
    } as unknown as Record<string, unknown>;

    render(
      <TestWrapper editable={true}>
        <NestedCaptionEditor
          initialCaptionJSON={malformedJSON}
          initialCaptionText="Recovered fallback text"
          placeholder="Caption..."
          onChange={handleChange}
          onError={handleError}
        />
      </TestWrapper>
    );

    // onError should have been called with the parse error
    expect(handleError).toHaveBeenCalled();

    // The editor must NOT be empty or crashed; it must recover using the fallback text
    const editableEl = screen.getByRole('textbox', { name: 'Caption...' });
    expect(editableEl).not.toBeNull();
    expect(editableEl.textContent).toBe('Recovered fallback text');
  });

  it('synchronizes when initialCaptionText is updated externally', async () => {
    const handleChange = vi.fn();
    const { rerender } = render(
      <TestWrapper editable={true}>
        <NestedCaptionEditor
          initialCaptionText="Initial Text"
          placeholder="Caption..."
          onChange={handleChange}
        />
      </TestWrapper>
    );

    const editableEl = screen.getByRole('textbox', { name: 'Caption...' });
    expect(editableEl.textContent).toBe('Initial Text');

    // Simulate external metadata update (e.g. from popover modal)
    await act(async () => {
      rerender(
        <TestWrapper editable={true}>
          <NestedCaptionEditor
            initialCaptionText="Updated from Popover"
            placeholder="Caption..."
            onChange={handleChange}
          />
        </TestWrapper>
      );
    });

    expect(editableEl.textContent).toBe('Updated from Popover');
  });

  describe('Card Editors Caption Stability (STU-R03)', () => {
    it('ImageCardEditor renders editable caption editor even when caption is already present', () => {
      const { container } = render(
        <TestWrapper editable={true}>
          <ImageCardEditor
            nodeKey="image-1"
            cardData={{
              src: 'https://example.com/photo.jpg',
              alt: 'A photo',
              caption: 'Existing photo caption',
              captionHtml: '<p>Existing photo caption</p>',
            }}
          />
        </TestWrapper>
      );

      // Must not render a static <figcaption> in edit mode
      expect(container.querySelector('figcaption')).toBeNull();
      // Must render active contenteditable with the caption
      const textbox = screen.getByRole('textbox', { name: 'Type caption for image (optional)' });
      expect(textbox).not.toBeNull();
      expect(textbox.textContent).toBe('Existing photo caption');
    });

    it('GalleryCardEditor renders editable caption editor with existing caption', () => {
      const { container } = render(
        <TestWrapper editable={true}>
          <GalleryCardEditor
            nodeKey="gallery-1"
            cardData={{
              images: [{ src: 'https://example.com/1.jpg', alt: 'img1', caption: '' }],
              caption: 'Gallery trip caption',
              width: 'regular',
            }}
          />
        </TestWrapper>
      );

      expect(container.querySelector('figcaption')).toBeNull();
      const textbox = screen.getByRole('textbox', { name: 'Type caption for gallery (optional)' });
      expect(textbox).not.toBeNull();
      expect(textbox.textContent).toBe('Gallery trip caption');
    });

    it('VideoCardEditor renders editable caption editor with existing caption', () => {
      const { container } = render(
        <TestWrapper editable={true}>
          <VideoCardEditor
            nodeKey="video-1"
            cardData={{
              src: 'https://example.com/video.mp4',
              caption: 'Video tutorial',
              loop: false,
              autoplay: false,
              width: 'regular',
            }}
          />
        </TestWrapper>
      );

      expect(container.querySelector('figcaption')).toBeNull();
      const textbox = screen.getByRole('textbox', { name: 'Type caption for video (optional)' });
      expect(textbox).not.toBeNull();
      expect(textbox.textContent).toBe('Video tutorial');
    });

    it('AudioCardEditor renders editable caption editor with existing caption', () => {
      const { container } = render(
        <TestWrapper editable={true}>
          <AudioCardEditor
            nodeKey="audio-1"
            cardData={{
              src: 'https://example.com/audio.mp3',
              title: 'Song title',
              caption: 'Audio recording',
            }}
          />
        </TestWrapper>
      );

      expect(container.querySelector('figcaption')).toBeNull();
      const textbox = screen.getByRole('textbox', { name: 'Type caption for audio (optional)' });
      expect(textbox).not.toBeNull();
      expect(textbox.textContent).toBe('Audio recording');
    });

    it('FileCardEditor renders editable caption editor with existing caption', () => {
      const { container } = render(
        <TestWrapper editable={true}>
          <FileCardEditor
            nodeKey="file-1"
            cardData={{
              src: 'https://example.com/report.pdf',
              fileName: 'report.pdf',
              fileSize: '1024',
              caption: 'Annual report PDF',
            }}
          />
        </TestWrapper>
      );

      expect(container.querySelector('figcaption')).toBeNull();
      const textbox = screen.getByRole('textbox', { name: 'Type caption for file (optional)' });
      expect(textbox).not.toBeNull();
      expect(textbox.textContent).toBe('Annual report PDF');
    });

    it('EmbedCardEditor renders editable caption editor with existing caption', () => {
      const { container } = render(
        <TestWrapper editable={true}>
          <EmbedCardEditor
            nodeKey="embed-1"
            cardData={{
              url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
              embedType: 'video',
              caption: 'Never Gonna Give You Up',
            }}
          />
        </TestWrapper>
      );

      expect(container.querySelector('figcaption')).toBeNull();
      const textbox = screen.getByRole('textbox', { name: 'Type caption for embed (optional)' });
      expect(textbox).not.toBeNull();
      expect(textbox.textContent).toBe('Never Gonna Give You Up');
    });
  });
});
