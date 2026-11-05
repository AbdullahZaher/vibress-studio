import { describe, it, expect } from 'vitest';
import { htmlToStudioDocument } from '@vibress/studio-html';
import { renderStudioDocumentToHtml, renderStudioDocumentToPlainText } from '@vibress/studio-renderer';
import { StudioDocument } from '@vibress/studio-core';

describe('HTML Import/Export Fidelity & Round-trip (Phase B)', () => {
  it('preserves linked images with rich captions in HTML round-trip', () => {
    const inputHtml = '<figure class="kg-card kg-image-card"><a href="https://example.com"><img src="https://example.com/banner.png" alt="Banner"></a><figcaption>Photo with <strong>rich</strong> and <em>styled</em> caption</figcaption></figure>';
    const doc = htmlToStudioDocument(inputHtml);

    // Verify AST structure
    expect(doc.root.children).toHaveLength(1);
    const card = doc.root.children[0] as { type: string; cardType: string; cardData: Record<string, unknown> };
    expect(card.type).toBe('studio-card');
    expect(card.cardType).toBe('image');
    expect(card.cardData.src).toBe('https://example.com/banner.png');
    expect(card.cardData.alt).toBe('Banner');
    expect(card.cardData.href).toBe('https://example.com');
    expect(card.cardData.caption).toBe('Photo with rich and styled caption');
    expect(card.cardData.captionHtml).toBe('Photo with <strong>rich</strong> and <em>styled</em> caption');

    // Round-trip to HTML
    const rendered = renderStudioDocumentToHtml(doc);
    expect(rendered).toContain('kg-image-card');
    expect(rendered).toContain('href="https://example.com"');
    expect(rendered).toContain('src="https://example.com/banner.png"');
    expect(rendered).toContain('<figcaption>Photo with <strong>rich</strong> and <em>styled</em> caption</figcaption>');
  });

  it('preserves layout width for wide and full width images', () => {
    const wideHtml = '<figure class="kg-card kg-image-card kg-width-wide"><img src="/wide.jpg" alt="Wide"></figure>';
    const doc = htmlToStudioDocument(wideHtml);
    const card = doc.root.children[0] as { cardData: Record<string, unknown> };
    expect(card.cardData.width).toBe('wide');

    const rendered = renderStudioDocumentToHtml(doc);
    expect(rendered).toContain('kg-width-wide');
  });

  it('preserves gallery cards with multiple images and captions in round-trip', () => {
    const galleryHtml = '<figure class="kg-card kg-gallery-card"><img src="/1.jpg" alt="Shot 1"><img src="/2.jpg" alt="Shot 2"><figcaption>Trip to <strong>Kyoto</strong></figcaption></figure>';
    const doc = htmlToStudioDocument(galleryHtml);

    expect(doc.root.children).toHaveLength(1);
    const card = doc.root.children[0] as { cardType: string; cardData: Record<string, unknown> };
    expect(card.cardType).toBe('gallery');
    expect(card.cardData.images).toHaveLength(2);
    expect(card.cardData.caption).toBe('Trip to Kyoto');
    expect(card.cardData.captionHtml).toBe('Trip to <strong>Kyoto</strong>');

    const rendered = renderStudioDocumentToHtml(doc);
    expect(rendered).toContain('kg-gallery-card');
    expect(rendered).toContain('/1.jpg');
    expect(rendered).toContain('/2.jpg');
    expect(rendered).toContain('<figcaption>Trip to <strong>Kyoto</strong></figcaption>');
  });

  it('preserves video cards with poster and caption in round-trip', () => {
    const videoHtml = '<figure class="kg-card kg-video-card"><video src="/demo.mp4" controls poster="/poster.jpg"></video><figcaption>Platform <em>Walkthrough</em></figcaption></figure>';
    const doc = htmlToStudioDocument(videoHtml);

    const card = doc.root.children[0] as { cardType: string; cardData: Record<string, unknown> };
    expect(card.cardType).toBe('video');
    expect(card.cardData.src).toBe('/demo.mp4');
    expect(card.cardData.poster).toBe('/poster.jpg');
    expect(card.cardData.caption).toBe('Platform Walkthrough');

    const rendered = renderStudioDocumentToHtml(doc);
    expect(rendered).toContain('kg-video-card');
    expect(rendered).toContain('src="/demo.mp4"');
    expect(rendered).toContain('poster="/poster.jpg"');
    expect(rendered).toContain('<figcaption>Platform <em>Walkthrough</em></figcaption>');
  });

  it('preserves callout, button, and bookmark publication cards', () => {
    const html = [
      '<div class="kg-card kg-callout-card bg-blue"><span class="emoji">💡</span><div class="content">Important announcement</div></div>',
      '<div class="kg-card kg-button-card align-center"><a href="https://example.com/signup" class="btn">Sign up now</a></div>',
      '<figure class="kg-card kg-bookmark-card"><a href="https://example.org"><div class="title">Example Org</div><div class="desc">A non-profit foundation</div></a></figure>',
    ].join('');

    const doc = htmlToStudioDocument(html);
    expect(doc.root.children).toHaveLength(3);

    const [callout, button, bookmark] = doc.root.children as Array<{ cardType: string; cardData: Record<string, unknown> }>;
    expect(callout).toBeDefined();
    expect(button).toBeDefined();
    expect(bookmark).toBeDefined();
    if (!callout || !button || !bookmark) return;

    expect(callout.cardType).toBe('callout');
    expect(callout.cardData.emoji).toBe('💡');
    expect(callout.cardData.text).toBe('Important announcement');
    expect(callout.cardData.backgroundColor).toBe('blue');

    expect(button.cardType).toBe('button');
    expect(button.cardData.text).toBe('Sign up now');
    expect(button.cardData.url).toBe('https://example.com/signup');

    expect(bookmark.cardType).toBe('bookmark');
    expect(bookmark.cardData.url).toBe('https://example.org');
    expect(bookmark.cardData.title).toBe('Example Org');
    expect(bookmark.cardData.description).toBe('A non-profit foundation');

    const rendered = renderStudioDocumentToHtml(doc);
    expect(rendered).toContain('kg-callout-card bg-blue');
    expect(rendered).toContain('kg-button-card align-center');
    expect(rendered).toContain('kg-bookmark-card');
  });

  it('preserves loose nested lists without dropping items', () => {
    const looseListHtml = '<ul><li>Item 1</li><ul><li>Nested 1.1</li><li>Nested 1.2</li></ul><li>Item 2</li></ul>';
    const doc = htmlToStudioDocument(looseListHtml);

    const plain = renderStudioDocumentToPlainText(doc);
    expect(plain).toContain('Item 1');
    expect(plain).toContain('Nested 1.1');
    expect(plain).toContain('Nested 1.2');
    expect(plain).toContain('Item 2');
  });

  it('preserves Arabic RTL tables with cell headers and spans in round-trip', () => {
    const tableHtml = '<div class="studio-table-container"><table class="studio-table" dir="rtl"><tbody><tr><th dir="rtl" colspan="2">التقرير المالي</th></tr><tr><td dir="rtl">الإيرادات</td><td dir="rtl">١,٠٠٠,٠٠٠</td></tr></tbody></table></div>';
    const doc = htmlToStudioDocument(tableHtml);

    const rendered = renderStudioDocumentToHtml(doc);
    expect(rendered).toContain('dir="rtl"');
    expect(rendered).toContain('colspan="2"');
    expect(rendered).toContain('<th');
    expect(rendered).toContain('التقرير المالي');
    expect(rendered).toContain('الإيرادات');

    const plain = renderStudioDocumentToPlainText(doc);
    expect(plain).toContain('التقرير المالي');
    expect(plain).toContain('الإيرادات\t١,٠٠٠,٠٠٠');
  });

  it('round-trips StudioDocument -> HTML -> StudioDocument preserving card data', () => {
    const originalDoc: StudioDocument = {
      schema: 'vibress-studio',
      version: 1,
      editor: { lexicalVersion: '0.13.1' },
      root: {
        type: 'root',
        direction: null,
        format: '',
        indent: 0,
        version: 1,
        children: [
          {
            type: 'heading',
            tag: 'h1',
            direction: 'rtl',
            children: [{ type: 'text', text: 'العنوان الرئيسي', format: 0, mode: 'normal', version: 1 }],
            version: 1,
          },
          {
            type: 'studio-card',
            cardType: 'image',
            cardData: {
              src: 'https://example.com/art.jpg',
              alt: 'Artwork',
              href: 'https://example.com/gallery',
              caption: 'Digital art by Studio',
              captionHtml: 'Digital art by <strong>Studio</strong>',
            },
            version: 1,
          },
        ],
      },
    };

    const html = renderStudioDocumentToHtml(originalDoc);
    const roundTripDoc = htmlToStudioDocument(html);

    expect(roundTripDoc.root.children).toHaveLength(2);
    const heading = roundTripDoc.root.children[0] as { type: string; direction: string };
    expect(heading.type).toBe('heading');
    expect(heading.direction).toBe('rtl');

    const imgCard = roundTripDoc.root.children[1] as { type: string; cardType: string; cardData: Record<string, unknown> };
    expect(imgCard.type).toBe('studio-card');
    expect(imgCard.cardType).toBe('image');
    expect(imgCard.cardData.src).toBe('https://example.com/art.jpg');
    expect(imgCard.cardData.alt).toBe('Artwork');
    expect(imgCard.cardData.href).toBe('https://example.com/gallery');
    expect(imgCard.cardData.caption).toBe('Digital art by Studio');
    expect(imgCard.cardData.captionHtml).toBe('Digital art by <strong>Studio</strong>');
  });
});
