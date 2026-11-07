import { describe, it, expect } from 'vitest';
import {
  renderStudioDocumentToHtml,
  renderStudioDocumentToPlainText,
  extractTableOfContentsFromDocument,
  HeadingSlugTracker,
} from '../index';
import { XSS_TEST_PAYLOADS } from '@vibress/studio-testing';

function doc(children: unknown[]): unknown {
  return { schema: 'vibress-studio', version: 1, root: { type: 'root', children } };
}

function card(cardType: string, cardData: Record<string, unknown>, type = 'studio-card'): unknown {
  return { type, cardType, cardData, version: 1 };
}

describe('renderStudioDocumentToHtml — all Studio cards', () => {
  it('renders text/heading/list/link/code', () => {
    const html = renderStudioDocumentToHtml(doc([
      { type: 'paragraph', children: [{ type: 'text', text: 'Hello ', format: 1, mode: 'normal', version: 1 }, { type: 'text', text: 'world', format: 0, mode: 'normal', version: 1 }], version: 1 },
      { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Sub', format: 0, mode: 'normal', version: 1 }], version: 1 },
      { type: 'list', listType: 'bullet', children: [{ type: 'listitem', children: [{ type: 'text', text: 'item', format: 0, mode: 'normal', version: 1 }], version: 1 }], version: 1 },
      { type: 'link', url: 'https://example.com', children: [{ type: 'text', text: 'link', format: 0, mode: 'normal', version: 1 }], version: 1 },
    ]));
    expect(html).toContain('<strong>Hello </strong>');
    expect(html).toContain('world');
    expect(html).toContain('<h2 id="sub">Sub');
    expect(html).toContain('class="heading-anchor"');
    expect(html).toContain('<li>item</li>');
    expect(html).toContain('<a href="https://example.com">link</a>');
  });

  it('enforces rel="noopener noreferrer" on target="_blank" links (STU-401)', () => {
    const html1 = renderStudioDocumentToHtml(doc([
      { type: 'link', url: 'https://example.com', target: '_blank', children: [{ type: 'text', text: 'External' }] },
    ]));
    expect(html1).toContain('target="_blank"');
    expect(html1).toContain('rel="noopener noreferrer"');

    // Combines with existing rel attributes safely
    const html2 = renderStudioDocumentToHtml(doc([
      { type: 'link', url: 'https://example.com', target: '_blank', rel: 'nofollow', children: [{ type: 'text', text: 'External Nofollow' }] },
    ]));
    expect(html2).toContain('target="_blank"');
    expect(html2).toContain('rel="nofollow noopener noreferrer"');

    // Standard links without target="_blank" do not get forced rel
    const html3 = renderStudioDocumentToHtml(doc([
      { type: 'link', url: 'https://example.com', children: [{ type: 'text', text: 'Internal' }] },
    ]));
    expect(html3).not.toContain('target="_blank"');
    expect(html3).not.toContain('rel=');
  });

  it('sanitizes code block language identifiers against attribute breakout (STU-202)', () => {
    const html = renderStudioDocumentToHtml(doc([
      { type: 'code', language: 'typescript"><script>alert(1)</script>', children: [{ type: 'text', text: 'const x = 1;' }] },
    ]));
    expect(html).not.toContain('<script>');
    expect(html).toContain('data-language="typescriptscriptalert1script"');
    expect(html).toContain('const x = 1;');
  });

  it('renders image card', () => {
    const html = renderStudioDocumentToHtml(doc([
      card('image', { src: '/content/media/a/b.png', alt: 'Alt text', caption: 'A caption', width: 'wide' }),
    ]));
    expect(html).toContain('<figure class="kg-card kg-image-card kg-width-wide">');
    expect(html).toContain('<img src="/content/media/a/b.png" alt="Alt text">');
    expect(html).toContain('<figcaption>A caption</figcaption>');
  });

  it('renders image card with numeric pixel dimensions from the media pipeline', () => {
    // The media pipeline records the asset's pixel width/height as numbers;
    // these must not break validation (they power intrinsic CLS attributes).
    const html = renderStudioDocumentToHtml(doc([
      card('image', { src: '/p.png', alt: 'p', width: 1200, height: 630 }),
    ]));
    expect(html).toContain('<img src="/p.png" alt="p" width="1200" height="630">');
    // numeric width must NOT produce a layout class
    expect(html).not.toContain('kg-width-1200');
  });

  it('renders gallery card', () => {
    const html = renderStudioDocumentToHtml(doc([
      card('gallery', { images: [
        { src: '/g1.png', alt: 'one' },
        { src: '/g2.png', alt: 'two' },
      ], caption: 'gal' }),
    ]));
    expect(html).toContain('kg-gallery-card');
    expect(html).toContain('/g1.png');
    expect(html).toContain('/g2.png');
    expect(html).toContain('<figcaption>gal</figcaption>');
  });

  it('renders video card with controls and poster', () => {
    const html = renderStudioDocumentToHtml(doc([
      card('video', { src: '/v.mp4', poster: '/poster.jpg', caption: 'vid' }),
    ]));
    expect(html).toContain('kg-video-card');
    expect(html).toContain('<video src="/v.mp4" controls');
    expect(html).toContain('poster="/poster.jpg"');
  });

  it('renders audio card', () => {
    const html = renderStudioDocumentToHtml(doc([
      card('audio', { src: '/a.mp3', title: 'Podcast' }),
    ]));
    expect(html).toContain('kg-audio-card');
    expect(html).toContain('<audio src="/a.mp3" controls');
    expect(html).toContain('Podcast');
  });

  it('renders file card as safe download link', () => {
    const html = renderStudioDocumentToHtml(doc([
      card('file', { src: '/f.pdf', fileName: 'report.pdf', fileSize: '1.2 MB' }),
    ]));
    expect(html).toContain('kg-file-card');
    expect(html).toContain('report.pdf');
    expect(html).toContain('download');
  });

  it('retains serialized rich captions in audio, file and embed public HTML', () => {
    const caption = { root: { type: 'root', children: [
      { type: 'paragraph', children: [{ type: 'text', text: 'مرحبا بالقراء', version: 1 }] },
    ] } };
    const captionHtml = '<p>مرحبا <strong>بالقراء</strong></p>';
    const input = doc([
      card('audio', { src: '/a.mp3', title: 'Podcast', caption, captionHtml }),
      card('file', { src: '/f.pdf', fileName: 'report.pdf', caption, captionHtml }),
      card('embed', { url: 'https://vimeo.com/123456', caption, captionHtml }),
    ]);
    const html = renderStudioDocumentToHtml(input);
    expect(html).toContain('kg-audio-card');
    expect(html).toContain('kg-file-card');
    expect(html).toContain('kg-embed-card');
    expect(html.split('مرحبا <strong>بالقراء</strong>').length - 1).toBe(3);
    expect(html).toContain('<div class="studio-media-caption"><p>مرحبا');
    expect(html).toContain('<figcaption><p>مرحبا');
    expect(renderStudioDocumentToPlainText(input)).toContain('مرحبا بالقراء');
  });

  it('removes executable markup from media caption HTML without dropping readable text', () => {
    const captionHtml = '<p>Safe <strong>content</strong></p><img src="/ok.png" onerror="alert(1)"><script>alert(2)</script>';
    const html = renderStudioDocumentToHtml(doc([
      card('audio', { src: '/a.mp3', captionHtml }),
      card('file', { src: '/report.pdf', fileName: 'report.pdf', captionHtml }),
      card('embed', { url: 'https://example.org', captionHtml }),
    ]));
    expect(html).toContain('Safe <strong>content</strong>');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('javascript:');
  });

  it('renders bookmark card with safe url', () => {
    const html = renderStudioDocumentToHtml(doc([
      card('bookmark', { url: 'https://example.com/a', title: 'Example', description: 'desc' }),
    ]));
    expect(html).toContain('kg-bookmark-card');
    expect(html).toContain('https://example.com/a');
    expect(html).toContain('Example');
  });

  it('renders embed card only for approved providers; others become safe links', () => {
    const yt = renderStudioDocumentToHtml(doc([
      card('embed', { url: 'https://www.youtube.com/watch?v=abc123', embedType: 'video' }),
    ]));
    expect(yt).toContain('kg-embed-card');
    expect(yt).toContain('<iframe src="https://www.youtube-nocookie.com/embed/abc123"');
    expect(yt).toContain('allowfullscreen');

    const evil = renderStudioDocumentToHtml(doc([
      card('embed', { url: 'https://evil.example/embed/x', embedType: 'video' }),
    ]));
    expect(evil).not.toContain('iframe');
    expect(evil).toContain('https://evil.example/embed/x');
  });

  it('uses the same safe embed policy for approved, unknown, invalid and legacy HTML data', () => {
    const provider = renderStudioDocumentToHtml(doc([
      card('embed', {
        url: 'https://vimeo.com/12345',
        html: '<iframe src="https://untrusted.example/embed"></iframe>',
        caption: 'Approved video',
      }),
    ]));
    expect(provider).toContain('https://player.vimeo.com/video/12345');
    expect(provider).not.toContain('untrusted.example');

    const external = renderStudioDocumentToHtml(doc([
      card('embed', { url: 'https://example.org/watch', html: '<script>alert(1)</script>' }),
    ]));
    expect(external).toContain('href="https://example.org/watch"');
    expect(external).not.toContain('<iframe');
    expect(external).not.toContain('<script');

    const invalid = renderStudioDocumentToHtml(doc([
      card('embed', { url: 'javascript:alert(1)', html: '<iframe src="https://vimeo.com/12345"></iframe>' }),
    ]));
    expect(invalid).toContain('Unsupported or unsafe embed URL.');
    expect(invalid).not.toContain('<iframe');
    expect(invalid).not.toContain('href="javascript:');
  });

  it('renders button card as a link', () => {
    const html = renderStudioDocumentToHtml(doc([
      card('button', { text: 'Buy now', url: 'https://store.example/p' }),
    ]));
    expect(html).toContain('kg-button-card');
    expect(html).toContain('href="https://store.example/p"');
    expect(html).toContain('Buy now');
    expect(html).not.toContain('<button');
  });

  it('renders callout card', () => {
    const html = renderStudioDocumentToHtml(doc([
      card('callout', { text: 'Note this', emoji: '💡', backgroundColor: 'grey' }),
    ]));
    expect(html).toContain('kg-callout-card');
    expect(html).toContain('💡');
    expect(html).toContain('Note this');
  });

  it('renders toggle card as details/summary', () => {
    const html = renderStudioDocumentToHtml(doc([
      card('toggle', { heading: 'FAQ', content: 'Answer' }),
    ]));
    expect(html).toContain('<details class="kg-card kg-toggle-card">');
    expect(html).toContain('<summary>FAQ</summary>');
    expect(html).toContain('Answer');
  });

  it('renders markdown card', () => {
    const html = renderStudioDocumentToHtml(doc([
      card('markdown', { markdown: '**bold** and a [link](https://example.com)' }),
    ]));
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('https://example.com');
  });

  it('renders html card sanitized (script stripped, safe html kept)', () => {
    const html = renderStudioDocumentToHtml(doc([
      card('html', { html: '<div class="widget">Safe <strong>widget</strong></div><script>alert(1)</script><img src=x onerror=alert(2)>' }),
    ]));
    expect(html).toContain('<div class="widget">Safe <strong>widget</strong></div>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
  });

  it('renders divider card as <hr>', () => {
    const html = renderStudioDocumentToHtml(doc([card('divider', {})]));
    expect(html).toContain('<hr>');
  });

  it('skips cards with transient blob: media', () => {
    const html = renderStudioDocumentToHtml(doc([
      card('image', { src: 'blob:http://localhost:7777/abc', alt: 'x' }),
      { type: 'paragraph', children: [{ type: 'text', text: 'kept', format: 0, mode: 'normal', version: 1 }], version: 1 },
    ]));
    expect(html).not.toContain('blob:');
    expect(html).toContain('kept');
  });
});

describe('legacy react-studio-card content', () => {
  it('normalizes and renders legacy cards', () => {
    const html = renderStudioDocumentToHtml(doc([
      card('image', { src: '/legacy.png', alt: 'legacy' }, 'react-studio-card'),
      card('video', { src: '/legacy.mp4' }, 'react-studio-card'),
    ]));
    expect(html).toContain('kg-image-card');
    expect(html).toContain('/legacy.png');
    expect(html).toContain('kg-video-card');
    expect(html).toContain('/legacy.mp4');
  });

  it('renders legacy cards nested inside paragraphs without stray empty <p>', () => {
    const html = renderStudioDocumentToHtml(doc([
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'intro', format: 0, mode: 'normal', version: 1 },
          card('image', { src: '/n.png', alt: 'n' }, 'react-studio-card'),
        ],
        version: 1,
      },
    ]));
    expect(html).toContain('intro');
    expect(html).toContain('kg-image-card');
    expect((html.match(/<p><\/p>/g) || []).length).toBe(0);
  });
});

describe('unknown/corrupt cards — graceful failure', () => {
  it('skips unknown card types without crashing the article', () => {
    const html = renderStudioDocumentToHtml(doc([
      card('mystery-card', { x: 1 }),
      { type: 'paragraph', children: [{ type: 'text', text: 'rest of article', format: 0, mode: 'normal', version: 1 }], version: 1 },
    ]));
    expect(html).toContain('rest of article');
    // Unknown card must not leak internal data or break the article.
    expect(html).not.toContain('mystery-card');
  });

  it('skips cards with corrupt cardData', () => {
    const html = renderStudioDocumentToHtml(doc([
      card('image', { src: 12345 }),
      { type: 'paragraph', children: [{ type: 'text', text: 'survives', format: 0, mode: 'normal', version: 1 }], version: 1 },
    ]));
    expect(html).toContain('survives');
  });

  it('never leaks card payloads for unknown/corrupt/transient cards (HTML + plain text)', () => {
    const secret = 'secret-user-content';
    const internalUrl = 'https://private.example/internal';
    const assetSecret = 'asset-secret-id';
    const sensitive = [secret, internalUrl, assetSecret];

    const input = doc([
      { type: 'studio-card', cardType: 'mystery-type', cardData: { secret, url: internalUrl, assetId: assetSecret, nested: { inner: secret } }, version: 1 },
      { type: 'studio-card', cardType: 'image', cardData: { secret, src: 12345, assetId: assetSecret, url: internalUrl }, version: 1 },
      { type: 'studio-card', cardType: 'video', cardData: { src: 'blob:http://localhost/xyz', secret }, version: 1 },
      { type: 'paragraph', children: [{ type: 'text', text: 'rest of article', format: 0, mode: 'normal', version: 1 }], version: 1 },
    ]);

    const html = renderStudioDocumentToHtml(input);
    expect(html).toContain('rest of article');
    for (const value of sensitive) {
      expect(html, `HTML must not leak ${value}`).not.toContain(value);
    }
    // No internal diagnostic comments reach the public HTML (sanitizer strips them).
    expect(html).not.toContain('<!--');

    const text = renderStudioDocumentToPlainText(input);
    expect(text).toContain('rest of article');
    for (const value of sensitive) {
      expect(text, `plain text must not leak ${value}`).not.toContain(value);
    }
    expect(text).not.toContain('blob:');
  });

  it('renders interactive tables with proper containers and headers', () => {
    const tableDoc = doc([
      {
        type: 'table',
        children: [
          {
            type: 'tablerow',
            children: [
              { type: 'tablecell', headerState: 1, children: [{ type: 'text', text: 'Column 1', format: 1 }] },
              { type: 'tablecell', headerState: 1, children: [{ type: 'text', text: 'Column 2', format: 1 }] },
            ],
          },
          {
            type: 'tablerow',
            children: [
              { type: 'tablecell', children: [{ type: 'text', text: 'Data 1', format: 0 }] },
              { type: 'tablecell', children: [{ type: 'text', text: 'Data 2', format: 0 }] },
            ],
          },
        ],
      },
    ]);
    const html = renderStudioDocumentToHtml(tableDoc);
    expect(html).toContain('studio-table-container');
    expect(html).toContain('<table class="studio-table">');
    expect(html).toContain('<th><strong>Column 1</strong></th>');
    expect(html).toContain('<td>Data 1</td>');
  });

  it('renders checklists with disabled checkboxes and state classes', () => {
    const checklistDoc = doc([
      {
        type: 'list',
        listType: 'check',
        children: [
          { type: 'listitem', checked: true, children: [{ type: 'text', text: 'Done task', format: 0 }] },
          { type: 'listitem', checked: false, children: [{ type: 'text', text: 'Pending task', format: 0 }] },
        ],
      },
    ]);
    const html = renderStudioDocumentToHtml(checklistDoc);
    expect(html).toContain('studio-checklist');
    expect(html).toContain('studio-checklist-item is-checked');
    expect(html).toContain('checked="checked"');
    expect(html).toContain('Done task');
    expect(html).toContain('Pending task');
  });

  it('renders nothing for empty documents', () => {
    expect(renderStudioDocumentToHtml({ root: { type: 'root', children: [] } })).toBe('');
  });
});

describe('security — XSS_TEST_PAYLOADS through the html card', () => {
  it('neutralizes every XSS payload while preserving safe content', () => {
    const payloads = XSS_TEST_PAYLOADS.join(' ');
    const html = renderStudioDocumentToHtml(doc([card('html', { html: payloads })]));
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onerror');
    expect(html).not.toContain('onclick');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('srcdoc');
  });
});

describe('renderStudioDocumentToPlainText', () => {
  it('includes card plain text and never leaks raw html', () => {
    const text = renderStudioDocumentToPlainText(doc([
      { type: 'paragraph', children: [{ type: 'text', text: 'Intro', format: 0, mode: 'normal', version: 1 }], version: 1 },
      card('image', { src: '/x.png', alt: '', caption: 'The cap' }),
      card('html', { html: '<p>Raw <strong>html</strong> text</p>' }),
      card('button', { text: 'CTA', url: 'https://x.com' }),
      card('divider', {}),
    ]));
    expect(text).toContain('Intro');
    expect(text).toContain('The cap');
    expect(text).toContain('Raw html text');
    expect(text).toContain('CTA');
    expect(text).toContain('---');
    expect(text).not.toContain('<strong>');
    expect(text).not.toContain('<p>');
  });

  it('extracts table of contents hierarchy correctly', () => {
    const toc = extractTableOfContentsFromDocument(doc([
      { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'First Section' }] },
      { type: 'paragraph', children: [{ type: 'text', text: 'Paragraph' }] },
      { type: 'heading', tag: 'h3', children: [{ type: 'text', text: 'Sub section' }] },
      { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'First Section' }] }, // duplicate title
    ]));

    expect(toc).toHaveLength(3);
    expect(toc[0]).toEqual({ id: 'first-section', text: 'First Section', level: 2 });
    expect(toc[1]).toEqual({ id: 'sub-section', text: 'Sub section', level: 3 });
    expect(toc[2]).toEqual({ id: 'first-section-1', text: 'First Section', level: 2 });
  });

  it('renders discoverable bilingual heading permalinks without hiding focusable links', () => {
    const article = doc([
      { type: 'heading', tag: 'h2', direction: 'rtl',
        children: [{ type: 'text', text: 'عنوان عربي English' }] },
    ]);
    const html = renderStudioDocumentToHtml(article);
    const container = document.createElement('article');
    container.innerHTML = html;
    const heading = container.querySelector('h2');
    const link = heading?.querySelector('a.heading-anchor');
    expect(heading?.getAttribute('id')).toBe('عنوان-عربي-english');
    expect(link?.getAttribute('href')).toBe('#عنوان-عربي-english');
    expect(link?.hasAttribute('aria-hidden')).toBe(false);
    expect(link?.getAttribute('aria-label')).toBe('Link to section: عنوان عربي English');
    expect(link?.getAttribute('tabindex')).toBeNull(); // Native keyboard-focusable link.
  });

  it('renders unique sequential heading IDs matching table of contents anchors (Phase D)', () => {
    const document = doc([
      { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'First Section' }] },
      { type: 'paragraph', children: [{ type: 'text', text: 'Body paragraph' }] },
      { type: 'heading', tag: 'h3', children: [{ type: 'text', text: 'Sub section' }] },
      { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'First Section' }] }, // duplicate
      { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'مقدمة' }] },
      { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'مقدمة' }] }, // duplicate Arabic
    ]);

    const toc = extractTableOfContentsFromDocument(document);
    const html = renderStudioDocumentToHtml(document);

    // Verify HTML contains matching id and anchor for each TOC entry
    for (const item of toc) {
      expect(html).toContain(`id="${item.id}"`);
      expect(html).toContain(`href="#${item.id}"`);
    }

    expect(html).toContain('<h2 id="first-section">');
    expect(html).toContain('<h2 id="first-section-1">');
    expect(html).toContain('<h2 id="مقدمة">');
    expect(html).toContain('<h2 id="مقدمة-1">');
  });

  it('unifies heading slug allocation across H1-H6 so TOC targets match HTML exactly (Finding 3)', () => {
    // Sibling H1 and H2 with identical titles:
    // H1 gets "overview", H2 gets "overview-1".
    // TOC only includes H2/H3, but its ID must be "overview-1", NOT "overview".
    const document = doc([
      { type: 'heading', tag: 'h1', children: [{ type: 'text', text: 'Overview' }] },
      { type: 'paragraph', children: [{ type: 'text', text: 'Intro paragraph' }] },
      { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'Overview' }] },
      { type: 'heading', tag: 'h4', children: [{ type: 'text', text: 'Deep Dive' }] },
      { type: 'heading', tag: 'h3', children: [{ type: 'text', text: 'Deep Dive' }] },
      { type: 'heading', tag: 'h1', children: [{ type: 'text', text: 'مقدمة' }] },
      { type: 'heading', tag: 'h2', children: [{ type: 'text', text: 'مقدمة' }] },
    ]);

    const toc = extractTableOfContentsFromDocument(document);
    const html = renderStudioDocumentToHtml(document);

    // Verify TOC contents
    expect(toc).toHaveLength(3);
    // H2 "Overview" must have slug "overview-1" because H1 took "overview"
    expect(toc[0]).toEqual({ id: 'overview-1', text: 'Overview', level: 2 });
    // H3 "Deep Dive" must have slug "deep-dive-1" because H4 took "deep-dive"
    expect(toc[1]).toEqual({ id: 'deep-dive-1', text: 'Deep Dive', level: 3 });
    // H2 "مقدمة" must have slug "مقدمة-1" because H1 took "مقدمة"
    expect(toc[2]).toEqual({ id: 'مقدمة-1', text: 'مقدمة', level: 2 });

    // Verify HTML has matching IDs and anchors
    expect(html).toContain('<h1 id="overview">Overview<a href="#overview" class="heading-anchor"');
    expect(html).toContain('<h2 id="overview-1">Overview<a href="#overview-1" class="heading-anchor"');
    expect(html).toContain('<h4 id="deep-dive">Deep Dive<a href="#deep-dive" class="heading-anchor"');
    expect(html).toContain('<h3 id="deep-dive-1">Deep Dive<a href="#deep-dive-1" class="heading-anchor"');
    expect(html).toContain('<h1 id="مقدمة">مقدمة<a href="#مقدمة" class="heading-anchor"');
    expect(html).toContain('<h2 id="مقدمة-1">مقدمة<a href="#مقدمة-1" class="heading-anchor"');

    // Every TOC item must match an anchor in the HTML
    for (const item of toc) {
      expect(html).toContain(`id="${item.id}"`);
      expect(html).toContain(`href="#${item.id}"`);
    }
  });

  it('handles empty and punctuation-only headings without collision or invalid anchors', () => {
    const document = doc([
      { type: 'heading', tag: 'h2', children: [{ type: 'text', text: '???' }] },
      { type: 'heading', tag: 'h2', children: [{ type: 'text', text: '!!!' }] },
      { type: 'heading', tag: 'h2', children: [{ type: 'text', text: '   ' }] },
      { type: 'heading', tag: 'h2', children: [] },
    ]);

    const toc = extractTableOfContentsFromDocument(document);
    const html = renderStudioDocumentToHtml(document);

    expect(toc).toHaveLength(2);
    expect(toc[0]).toEqual({ id: 'heading', text: '???', level: 2 });
    expect(toc[1]).toEqual({ id: 'heading-1', text: '!!!', level: 2 });

    expect(html).toContain('<h2 id="heading">???<a href="#heading"');
    expect(html).toContain('<h2 id="heading-1">!!!<a href="#heading-1"');
    // Whitespace only heading gets no ID or anchor
    expect(html).toContain('<h2>   </h2>');
    expect(html).toContain('<h2></h2>');
  });

  it('HeadingSlugTracker correctly tracks, allocates, and resets slug state', () => {
    const tracker = new HeadingSlugTracker();
    expect(tracker.allocate('Getting Started')).toBe('getting-started');
    expect(tracker.allocate('Getting Started')).toBe('getting-started-1');
    expect(tracker.allocate('Getting Started')).toBe('getting-started-2');
    expect(tracker.allocate('   ')).toBe('');
    expect(tracker.allocate('***')).toBe('heading');
    expect(tracker.allocate('***')).toBe('heading-1');

    tracker.reset();
    expect(tracker.allocate('Getting Started')).toBe('getting-started');
  });

  it('never emits duplicate IDs for explicit suffixed titles and repeated base titles', () => {
    const headings = ['foo', 'foo-1', 'foo', 'foo-2', 'foo', 'foo-1', 'مقدمة', 'مقدمة-1', 'مقدمة'];
    const input = doc(headings.map((text, index) => ({
      type: 'heading',
      tag: index % 2 === 0 ? 'h2' : 'h1',
      children: [{ type: 'text', text }],
    })));
    const tracker = new HeadingSlugTracker();
    const allocated = headings.map((text) => tracker.allocate(text));
    expect(allocated).toEqual([
      'foo', 'foo-1', 'foo-2', 'foo-2-1', 'foo-3', 'foo-1-1',
      'مقدمة', 'مقدمة-1', 'مقدمة-2',
    ]);
    expect(new Set(allocated).size).toBe(allocated.length);

    const rendered = renderStudioDocumentToHtml(input);
    const matches = [...rendered.matchAll(/<h[1-6] id="([^"]+)"/g)];
    const ids = matches.map((match) => match[1]);
    expect(ids).toEqual(allocated);
    const toc = extractTableOfContentsFromDocument(input);
    for (const item of toc) {
      expect(ids).toContain(item.id);
      expect(rendered).toContain(`href="#${item.id}"`);
    }
    tracker.reset();
    expect(tracker.allocate('foo')).toBe('foo');
  });

  it('renders structured plain text for lists, checklists and tables (Phase D)', () => {
    const document = doc([
      {
        type: 'list',
        listType: 'bullet',
        children: [
          { type: 'listitem', children: [{ type: 'text', text: 'Apple' }] },
          { type: 'listitem', children: [{ type: 'text', text: 'Banana' }] },
        ],
      },
      {
        type: 'list',
        listType: 'number',
        start: 1,
        children: [
          { type: 'listitem', children: [{ type: 'text', text: 'Step 1' }] },
          { type: 'listitem', children: [{ type: 'text', text: 'Step 2' }] },
        ],
      },
      {
        type: 'list',
        listType: 'check',
        children: [
          { type: 'listitem', checked: true, children: [{ type: 'text', text: 'Done' }] },
          { type: 'listitem', checked: false, children: [{ type: 'text', text: 'Todo' }] },
        ],
      },
      {
        type: 'table',
        children: [
          {
            type: 'tablerow',
            children: [
              { type: 'tablecell', children: [{ type: 'text', text: 'Col 1' }] },
              { type: 'tablecell', children: [{ type: 'text', text: 'Col 2' }] },
            ],
          },
          {
            type: 'tablerow',
            children: [
              { type: 'tablecell', children: [{ type: 'text', text: 'Val 1' }] },
              { type: 'tablecell', children: [{ type: 'text', text: 'Val 2' }] },
            ],
          },
        ],
      },
    ]);

    const plain = renderStudioDocumentToPlainText(document);
    expect(plain).toContain('• Apple\n• Banana');
    expect(plain).toContain('1. Step 1\n2. Step 2');
    expect(plain).toContain('[x] Done\n[ ] Todo');
    expect(plain).toContain('Col 1\tCol 2\nVal 1\tVal 2');
  });

  it('renders table cell direction attribute on th and td (Phase D)', () => {
    const tableDoc = doc([
      {
        type: 'table',
        children: [
          {
            type: 'tablerow',
            children: [
              {
                type: 'tablecell',
                headerState: 1,
                direction: 'rtl',
                children: [{ type: 'text', text: 'رأس الجدول' }],
              },
              {
                type: 'tablecell',
                direction: 'rtl',
                children: [{ type: 'text', text: 'بيانات' }],
              },
            ],
          },
        ],
      },
    ]);

    const html = renderStudioDocumentToHtml(tableDoc);
    expect(html).toContain('<th dir="rtl">');
    expect(html).toContain('<td dir="rtl">');
  });
});

describe('editor-to-public rendering fidelity (STU-R04)', () => {
  it('renders text color and highlight styles to safe inline span style', () => {
    const html = renderStudioDocumentToHtml(doc([
      {
        type: 'paragraph',
        children: [
          {
            type: 'text',
            text: 'Colored and highlighted',
            format: 0,
            style: 'color: #1d4ed8; background-color: #dbeafe',
            mode: 'normal',
            version: 1,
          },
        ],
        version: 1,
      },
    ]));
    expect(html).toContain('<span style="color: #1d4ed8; background-color: #dbeafe">Colored and highlighted</span>');
  });

  it('renders subscript and superscript text formats', () => {
    const html = renderStudioDocumentToHtml(doc([
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'H', format: 0, mode: 'normal', version: 1 },
          { type: 'text', text: '2', format: 32, mode: 'normal', version: 1 },
          { type: 'text', text: 'O and E=mc', format: 0, mode: 'normal', version: 1 },
          { type: 'text', text: '2', format: 64, mode: 'normal', version: 1 },
        ],
        version: 1,
      },
    ]));
    expect(html).toContain('<sub>2</sub>');
    expect(html).toContain('<sup>2</sup>');
  });

  it('renders paragraph and heading alignment safely', () => {
    const html = renderStudioDocumentToHtml(doc([
      {
        type: 'paragraph',
        style: 'text-align: center',
        direction: 'rtl',
        children: [{ type: 'text', text: 'نص في الوسط', format: 0, mode: 'normal', version: 1 }],
        version: 1,
      },
      {
        type: 'heading',
        tag: 'h3',
        style: 'text-align: right',
        children: [{ type: 'text', text: 'عنوان فرعي', format: 0, mode: 'normal', version: 1 }],
        version: 1,
      },
    ]));
    expect(html).toContain('<p dir="rtl" style="text-align: center">نص في الوسط</p>');
    expect(html).toContain('style="text-align: right"');
  });

  it('sanitizes and strips dangerous CSS from paragraph and heading styles', () => {
    const html = renderStudioDocumentToHtml(doc([
      {
        type: 'paragraph',
        style: 'position: fixed; top: 0; background: url(javascript:alert(1)); text-align: center',
        children: [{ type: 'text', text: 'Safe text', format: 0, mode: 'normal', version: 1 }],
        version: 1,
      },
    ]));
    expect(html).not.toContain('position: fixed');
    expect(html).not.toContain('background: url');
    expect(html).not.toContain('javascript:');
    expect(html).toContain('style="text-align: center"');
  });

  it('renders table cell background colors and cell styles safely', () => {
    const tableDoc = doc([
      {
        type: 'table',
        children: [
          {
            type: 'tablerow',
            children: [
              {
                type: 'tablecell',
                backgroundColor: '#fef3c7',
                children: [{ type: 'text', text: 'Yellow cell', format: 0 }],
              },
              {
                type: 'tablecell',
                backgroundColor: 'red; position: fixed', // Malicious/invalid color injection
                children: [{ type: 'text', text: 'Clean cell', format: 0 }],
              },
            ],
          },
        ],
      },
    ]);
    const html = renderStudioDocumentToHtml(tableDoc);
    expect(html).toContain('<td style="background-color: #fef3c7">Yellow cell</td>');
    expect(html).not.toContain('position: fixed');
    expect(html).toContain('<td>Clean cell</td>');
  });

  it('renders captions from Lexical JSON objects when captionHtml is omitted', () => {
    const jsonCaption = {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Recovered from Lexical JSON caption' },
            ],
          },
        ],
      },
    };

    const html = renderStudioDocumentToHtml(doc([
      card('image', {
        src: '/test.png',
        alt: 'Test',
        caption: jsonCaption,
      }),
      card('gallery', {
        images: [{ src: '/g.png', alt: 'G' }],
        caption: jsonCaption,
      }),
      card('video', {
        src: '/v.mp4',
        caption: jsonCaption,
      }),
      card('embed', {
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        caption: jsonCaption,
      }),
    ]));

    expect(html).toContain('<figcaption>Recovered from Lexical JSON caption</figcaption>');
  });
});

describe('code block interactive controls (STU-R17)', () => {
  it('does not emit dead copy buttons in static server rendering by default', () => {
    const html = renderStudioDocumentToHtml(doc([
      {
        type: 'code',
        language: 'typescript',
        children: [{ type: 'text', text: 'const x = 1;', format: 0, mode: 'normal', version: 1 }],
        version: 1,
      },
    ]));

    expect(html).toContain('class="studio-code-block"');
    expect(html).toContain('<span class="studio-code-lang">typescript</span>');
    expect(html).toContain('<code>const x = 1;</code>');
    expect(html).not.toContain('studio-code-copy-btn');
    expect(html).not.toContain('Copy');
  });

  it('emits copy button when interactiveControls is explicitly enabled', () => {
    const html = renderStudioDocumentToHtml(
      doc([
        {
          type: 'code',
          language: 'python',
          children: [{ type: 'text', text: 'print("hello")', format: 0, mode: 'normal', version: 1 }],
          version: 1,
        },
      ]),
      { interactiveControls: true }
    );

    expect(html).toContain('class="studio-code-block"');
    expect(html).toContain('<span class="studio-code-lang">python</span>');
    expect(html).toContain('<button type="button" class="studio-code-copy-btn" aria-label="Copy code">Copy</button>');
    expect(html).toContain('<code>print("hello")</code>');
  });

  describe('Malformed known node handling and safe fallbacks (STU-201, STU-202)', () => {
    it('safely renders headings with non-string or unknown tags without throwing', () => {
      const html1 = renderStudioDocumentToHtml(doc([
        { type: 'heading', tag: 42, children: [{ type: 'text', text: 'Numeric Tag' }] },
      ]));
      expect(html1).toContain('<h2 id="numeric-tag">Numeric Tag');

      const html2 = renderStudioDocumentToHtml(doc([
        { type: 'heading', tag: 'h99', children: [{ type: 'text', text: 'Unsupported Tag' }] },
      ]));
      expect(html2).toContain('<h2 id="unsupported-tag">Unsupported Tag');
    });

    it('safely renders text nodes with null or non-string text', () => {
      const html = renderStudioDocumentToHtml(doc([
        { type: 'paragraph', children: [{ type: 'text', text: null }, { type: 'text', text: 42 }, { type: 'text', text: 'Safe' }] },
      ]));
      expect(html).toContain('<p>42Safe</p>');
    });

    it('safely renders links with non-string url or invalid target', () => {
      const html = renderStudioDocumentToHtml(doc([
        { type: 'link', url: 123, target: 'untrusted_window', children: [{ type: 'text', text: 'Link Text' }] },
      ]));
      expect(html).toContain('<a href="#">Link Text</a>');
      expect(html).not.toContain('target="untrusted_window"');
    });

    it('safely renders paragraphs and tables with malformed or non-array children', () => {
      const html = renderStudioDocumentToHtml(doc([
        { type: 'paragraph', children: 'invalid' },
        { type: 'table', children: null },
      ]));
      expect(html).toContain('<p></p>');
      expect(html).toContain('<table class="studio-table"><tbody></tbody></table>');
    });

    it('safely extracts table of contents from documents with malformed heading tags', () => {
      const toc = extractTableOfContentsFromDocument(doc([
        { type: 'heading', tag: 42, children: [{ type: 'text', text: 'Overview' }] },
        { type: 'heading', tag: 'h3', children: [{ type: 'text', text: 'Details' }] },
      ]));
      expect(toc.length).toBe(2);
      expect(toc[0]?.id).toBe('overview');
      expect(toc[0]?.level).toBe(2);
      expect(toc[1]?.id).toBe('details');
      expect(toc[1]?.level).toBe(3);
    });

    it('safely renders plain text from documents with malformed nodes', () => {
      const plain = renderStudioDocumentToPlainText(doc([
        { type: 'heading', tag: 42, children: [{ type: 'text', text: 'Overview' }] },
        { type: 'paragraph', children: [{ type: 'text', text: null }, { type: 'text', text: 42 }] },
        { type: 'studio-card', cardType: 123, cardData: null },
      ]));
      expect(plain).toContain('Overview');
      expect(plain).toContain('42');
    });
  });

  it('keeps a nested list within its numbered item without advancing the counter', () => {
    const listItem = (...children: unknown[]) => ({ type: 'listitem', children });
    const text = (value: string) => ({ type: 'text', text: value });
    const source = doc([{
      type: 'list', listType: 'number', start: 4,
      children: [
        listItem(text('Four')),
        listItem({ type: 'list', listType: 'bullet', children: [listItem(text('Nested'))] }),
        listItem(text('Five')),
      ],
    }]);
    const before = JSON.stringify(source);
    expect(renderStudioDocumentToHtml(source)).toBe(
      '<ol start="4"><li>Four<ul><li>Nested</li></ul></li><li>Five</li></ol>',
    );
    expect(JSON.stringify(source)).toBe(before);
  });

  it('preserves positive ordered-list start attributes without emitting unsafe values', () => {
    const makeList = (start?: unknown, listType = 'number') => ({
      type: 'list',
      listType,
      ...(start !== undefined ? { start } : {}),
      children: [{ type: 'listitem', children: [{ type: 'text', text: 'Item' }] }],
    });
    expect(renderStudioDocumentToHtml(doc([makeList(5)]))).toContain('<ol start="5"><li>Item</li></ol>');
    expect(renderStudioDocumentToHtml(doc([makeList(1)]))).toContain('<ol><li>Item</li></ol>');
    expect(renderStudioDocumentToHtml(doc([makeList('5')]))).toContain('<ol><li>Item</li></ol>');
    expect(renderStudioDocumentToHtml(doc([makeList(-5)]))).toContain('<ol><li>Item</li></ol>');
    expect(renderStudioDocumentToHtml(doc([makeList(5, 'bullet')]))).toContain('<ul><li>Item</li></ul>');
  });

});
