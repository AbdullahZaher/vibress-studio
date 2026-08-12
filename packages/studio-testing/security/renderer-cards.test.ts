import { describe, it, expect } from 'vitest';
import { STUDIO_CARD_DEFINITIONS } from '@vibress/studio-cards';
import { renderStudioDocumentToHtml } from '@vibress/studio-renderer';
import { XSS_PAYLOADS } from './xss-payloads.test';

/**
 * P2: every built-in card renderer must be safe by default. All XSS payloads
 * must be neutralized regardless of which field they land in.
 */
function renderCard(cardType: string, cardData: Record<string, unknown>): string {
  const def = STUDIO_CARD_DEFINITIONS[cardType];
  if (!def) throw new Error(`unknown card ${cardType}`);
  const validated = def.validate(cardData);
  return def.renderHtml(validated);
}

const FORBIDDEN_TAGS = ['script', 'object', 'embed', 'form', 'input', 'button', 'svg', 'math', 'style'];

/**
 * Parse rendered HTML and assert no live dangerous elements or attributes
 * exist. Escaped text content (e.g. `&lt;img onerror=...&gt;`) is safe and
 * must NOT be flagged, so we inspect the DOM, not raw strings.
 */
function assertSafeHtml(html: string, context: string, opts: { allowIframe?: boolean } = {}) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const forbidden = opts.allowIframe ? FORBIDDEN_TAGS : [...FORBIDDEN_TAGS, 'iframe'];
  for (const tag of forbidden) {
    expect(doc.querySelectorAll(tag).length, `${context}: no <${tag}>`).toBe(0);
  }
  for (const el of Array.from(doc.querySelectorAll('*'))) {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      expect(name, `${context}: no event-handler/style attr`).not.toMatch(/^on[a-z]+$/);
      expect(name, `${context}: no srcdoc`).not.toBe('srcdoc');
      expect(name, `${context}: no style attr`).not.toBe('style');
      expect(name, `${context}: no svg namespace`).not.toMatch(/^xmlns/);
      expect(attr.value, `${context}: ${name} has no dangerous protocol`).not.toMatch(/^\s*(javascript|vbscript|file|data):/i);
      expect(attr.value, `${context}: ${name} has no svg data url`).not.toContain('data:image/svg+xml');
    }
  }
  expect(doc.querySelectorAll('*').length, `${context}: produces elements`).toBeGreaterThan(0);
}

/** For embed cards an iframe from a provider-allowlisted URL is allowed. */
function assertSafeEmbedHtml(html: string, context: string) {
  assertSafeHtml(html, context, { allowIframe: true });
  expect(html).not.toContain('srcdoc');
}

describe('Card renderers — image', () => {
  it('escapes alt/caption and sanitizes URL', () => {
    const html = renderCard('image', {
      src: 'https://example.com/a.jpg',
      alt: '<script>alert(1)</script>',
      captionHtml: '<img src=x onerror=alert(1)>',
    });
    assertSafeHtml(html, 'image');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('onerror');
  });

  it('rejects javascript: src and svg data urls at validation', () => {
    expect(() => renderCard('image', { src: 'javascript:alert(1)', alt: 'x' })).toThrow();
    expect(() =>
      renderCard('image', { src: 'data:image/svg+xml,<svg onload=alert(1)>' })
    ).toThrow();
  });

  it('renders width/height as numbers only', () => {
    const html = renderCard('image', { src: 'https://example.com/a.jpg', width: 'wide', height: 300 });
    expect(html).toContain('kg-width-wide');
    expect(html).toContain('height="300"');
    // string heights are rejected by schema (no attribute injection)
    expect(() => renderCard('image', { src: 'https://example.com/a.jpg', height: '300" onerror="x' })).toThrow();
  });

  it('uses lazy loading and safe href', () => {
    const html = renderCard('image', { src: 'https://example.com/a.jpg', href: 'https://target.example' });
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('href="https://target.example"');
    expect(() => renderCard('image', { src: 'https://example.com/a.jpg', href: 'javascript:alert(1)' })).toThrow();
  });
});

describe('Card renderers — gallery', () => {
  it('sanitizes every image and escapes captions', () => {
    const html = renderCard('gallery', {
      images: [
        { src: 'https://example.com/1.jpg', alt: 'one' },
        { src: 'https://example.com/2.jpg', alt: '<img src=x onerror=alert(1)>' },
      ],
      captionHtml: '<svg onload=alert(1)>',
    });
    assertSafeHtml(html, 'gallery');
    expect(html).toContain('&lt;img');
    // dangerous src rejected by schema
    expect(() =>
      renderCard('gallery', { images: [{ src: 'https://ok.example/a.jpg' }, { src: 'javascript:alert(1)' }] })
    ).toThrow();
  });
});

describe('Card renderers — video/audio', () => {
  it('sanitizes media URL and poster', () => {
    const html = renderCard('video', {
      src: 'https://example.com/v.mp4',
      poster: 'https://example.com/p.jpg',
    });
    assertSafeHtml(html, 'video');
    expect(html).toContain('poster="https://example.com/p.jpg"');
    expect(() => renderCard('video', { src: 'https://example.com/v.mp4', poster: 'javascript:alert(1)' })).toThrow();
    expect(() => renderCard('video', { src: 'javascript:alert(1)' })).toThrow();
  });

  it('does not autoplay unless explicitly configured', () => {
    const noAutoplay = renderCard('video', { src: 'https://example.com/v.mp4' });
    expect(noAutoplay).not.toContain('autoplay');

    const withAutoplay = renderCard('video', { src: 'https://example.com/v.mp4', autoplay: true });
    expect(withAutoplay).toContain('autoplay muted playsinline');
  });

  it('audio card escapes title', () => {
    const html = renderCard('audio', { src: 'https://example.com/a.mp3', title: '<script>x</script>' });
    assertSafeHtml(html, 'audio');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('Card renderers — file', () => {
  it('sanitizes URL and escapes filename', () => {
    const html = renderCard('file', {
      src: 'https://example.com/f.bin',
      fileName: '"><script>alert(1)</script>',
    });
    assertSafeHtml(html, 'file');
    expect(html).toContain('&lt;script&gt;');
    expect(() => renderCard('file', { src: 'javascript:alert(1)', fileName: 'x' })).toThrow();
  });
});

describe('Card renderers — bookmark', () => {
  it('sanitizes and escapes all fields', () => {
    const html = renderCard('bookmark', {
      url: 'https://example.com/article',
      title: '<script>t</script>',
      description: '<img src=x onerror=alert(1)>',
      thumbnail: 'https://example.com/t.png',
    });
    assertSafeHtml(html, 'bookmark');
    expect(() => renderCard('bookmark', { url: 'https://example.com', thumbnail: 'javascript:alert(1)' })).toThrow();
  });

  it('malformed URL never crashes renderHtml', () => {
    const def = STUDIO_CARD_DEFINITIONS.bookmark;
    const html = def.renderHtml({ url: 'not a valid url but no scheme', title: '', description: '' });
    expect(html).toContain('<a href="not a valid url but no scheme"');
    expect(html).not.toContain('javascript:');
    // Truly dangerous URLs are rejected earlier by schema validation.
    expect(() => renderCard('bookmark', { url: 'javascript:alert(1)' })).toThrow();
  });
});

describe('Card renderers — embed', () => {
  it('allowlists iframe providers', () => {
    const html = renderCard('embed', { url: 'https://www.youtube.com/watch?v=abc123' });
    expect(html).toContain('<iframe');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('referrerpolicy="no-referrer"');
    assertSafeEmbedHtml(html, 'embed youtube');
  });

  it('renders unsupported embeds as safe links, never iframes', () => {
    const html = renderCard('embed', { url: 'https://evil.example/embed?x=1' });
    expect(html).not.toContain('<iframe');
    expect(html).toContain('<a href=');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('sanitizes raw embed HTML (iframes stripped)', () => {
    const html = renderCard('embed', {
      url: 'https://example.com/embed',
      html: '<iframe src="https://evil.example" srcdoc="<script>alert(1)</script>"></iframe><p>ok</p>',
    });
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('srcdoc');
    expect(html).toContain('ok');
  });

  it('rejects javascript: embed urls', () => {
    expect(() => renderCard('embed', { url: 'javascript:alert(1)' })).toThrow();
  });
});

describe('Card renderers — button', () => {
  it('sanitizes href and escapes label', () => {
    const html = renderCard('button', { text: '<b>label</b>" onmouseover=x', url: 'https://example.com' });
    assertSafeHtml(html, 'button');
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(() => renderCard('button', { text: 'x', url: 'javascript:alert(1)' })).toThrow();
  });
});

describe('Card renderers — callout/toggle', () => {
  it('escapes callout text (no raw HTML)', () => {
    const html = renderCard('callout', { text: '<img src=x onerror=alert(1)>', emoji: '💡' });
    assertSafeHtml(html, 'callout');
    expect(html).toContain('&lt;img');
  });

  it('rejects unsafe backgroundColor class injection', () => {
    expect(() =>
      renderCard('callout', { text: 'x', backgroundColor: 'red" onclick="alert(1)' })
    ).toThrow();
  });

  it('escapes toggle heading and content', () => {
    const html = renderCard('toggle', { heading: '<script>h</script>', content: '<svg onload=alert(1)>' });
    assertSafeHtml(html, 'toggle');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('Card renderers — markdown', () => {
  it('sanitizes markdown output after conversion', () => {
    const html = renderCard('markdown', {
      markdown:
        '# Hi\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n<img src=x onerror=alert(1)>',
    });
    assertSafeHtml(html, 'markdown');
    expect(html).toContain('<h1>Hi</h1>');
    expect(html).not.toContain('<script>');
  });

  it('escapes code blocks', () => {
    const html = renderCard('markdown', { markdown: '```js\n<script>alert(1)</script>\n```' });
    expect(html).not.toContain('<script>alert(1)</script>');
  });
});

describe('Card renderers — HTML card (Option B: strict sanitization)', () => {
  it('never emits raw HTML', () => {
    const html = renderCard('html', { html: XSS_PAYLOADS.join('\n') });
    assertSafeHtml(html, 'html card');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<iframe');
    expect(html).not.toContain('onerror');
  });

  it('preserves safe subset of HTML', () => {
    const html = renderCard('html', {
      html: '<p><strong>Safe</strong> <a href="https://example.com" target="_blank" rel="noopener">link</a></p>',
    });
    expect(html).toContain('<strong>Safe</strong>');
    expect(html).toContain('<a href="https://example.com"');
  });
});

describe('Card renderers — full document pipeline', () => {
  it.each([
    ['image', { src: 'https://example.com/a.jpg', alt: XSS_PAYLOADS[1] }],
    ['video', { src: 'https://example.com/v.mp4' }],
    ['audio', { src: 'https://example.com/a.mp3' }],
    ['file', { src: 'https://example.com/f.bin', fileName: XSS_PAYLOADS[0] }],
    ['bookmark', { url: 'https://example.com', title: XSS_PAYLOADS[0] }],
    ['embed', { url: 'https://www.youtube.com/watch?v=x' }],
    ['button', { text: XSS_PAYLOADS[0], url: 'https://example.com' }],
    ['callout', { text: XSS_PAYLOADS[0] }],
    ['toggle', { heading: XSS_PAYLOADS[0], content: '' }],
    ['markdown', { markdown: XSS_PAYLOADS[0] }],
    ['html', { html: XSS_PAYLOADS[0] }],
  ] as const)('document render with %s card is safe', (cardType, cardData) => {
    const doc = {
      schema: 'vibress-studio',
      version: 1,
      editor: { lexicalVersion: '0.13.1' },
      root: {
        type: 'root',
        children: [{ type: 'studio-card', cardType, cardData: { ...cardData }, version: 1 }],
        version: 1,
      },
    };
    const html = renderStudioDocumentToHtml(doc);
    if (cardType === 'embed') {
      assertSafeEmbedHtml(html, `${cardType} in document`);
    } else {
      assertSafeHtml(html, `${cardType} in document`);
    }
  });

  it('malformed card data never crashes the document renderer', () => {
    const doc = {
      schema: 'vibress-studio',
      version: 1,
      editor: { lexicalVersion: '0.13.1' },
      root: {
        type: 'root',
        children: [
          { type: 'studio-card', cardType: 'image', cardData: { src: 'javascript:alert(1)' }, version: 1 },
          { type: 'studio-card', cardType: 'unknown-card-type', cardData: {}, version: 1 },
        ],
        version: 1,
      },
    };
    const html = renderStudioDocumentToHtml(doc);
    expect(html).not.toContain('javascript:');
    expect(html).toContain('Unknown card');
  });
});
