import { describe, it, expect } from 'vitest';
import { studioDocumentToMarkdown } from '../index';

function doc(children: unknown[]): unknown {
  return {
    schema: 'vibress-studio',
    version: 1,
    root: { type: 'root', children },
  };
}

function card(cardType: string, cardData: Record<string, unknown>): unknown {
  return { type: 'studio-card', cardType, cardData, version: 1 };
}

describe('studioDocumentToMarkdown — GFM Tables, Checklists, Code and Cards (STU-R12)', () => {
  it('converts Lexical tables to GFM Markdown tables', () => {
    const md = studioDocumentToMarkdown(
      doc([
        {
          type: 'table',
          children: [
            {
              type: 'tablerow',
              children: [
                { type: 'tablecell', children: [{ type: 'text', text: 'Product' }] },
                { type: 'tablecell', children: [{ type: 'text', text: 'Price' }] },
              ],
            },
            {
              type: 'tablerow',
              children: [
                { type: 'tablecell', children: [{ type: 'text', text: 'Studio Pro' }] },
                { type: 'tablecell', children: [{ type: 'text', text: '$29' }] },
              ],
            },
          ],
        },
      ])
    );

    expect(md).toContain('| Product | Price |');
    expect(md).toContain('| --- | --- |');
    expect(md).toContain('| Studio Pro | $29 |');
  });

  it('converts checklists to GFM task list syntax', () => {
    const md = studioDocumentToMarkdown(
      doc([
        {
          type: 'list',
          listType: 'check',
          children: [
            {
              type: 'listitem',
              checked: true,
              children: [{ type: 'text', text: 'Completed task' }],
            },
            {
              type: 'listitem',
              checked: false,
              children: [{ type: 'text', text: 'Pending task' }],
            },
          ],
        },
      ])
    );

    expect(md).toContain('- [x] Completed task');
    expect(md).toContain('- [ ] Pending task');
  });

  it('preserves code block language identifier', () => {
    const md = studioDocumentToMarkdown(
      doc([
        {
          type: 'code',
          language: 'typescript',
          children: [{ type: 'text', text: 'const x: number = 42;' }],
        },
      ])
    );

    expect(md).toBe('```typescript\nconst x: number = 42;\n```');
  });

  it('exports rich cards to readable semantic Markdown fallbacks', () => {
    const md = studioDocumentToMarkdown(
      doc([
        card('image', {
          src: 'https://example.com/banner.png',
          alt: 'Banner image',
          caption: 'Editorial photo by Jane Doe',
        }),
        card('gallery', {
          images: [
            { src: 'https://example.com/1.jpg', alt: 'Shot 1' },
            { src: 'https://example.com/2.jpg', alt: 'Shot 2' },
          ],
          caption: 'Trip to Kyoto',
        }),
        card('video', {
          src: 'https://example.com/demo.mp4',
          caption: 'Platform Walkthrough',
        }),
        card('audio', {
          src: 'https://example.com/podcast.mp3',
          title: 'Episode 42: Building Editors',
        }),
        card('file', {
          src: 'https://example.com/annual-report.pdf',
          title: '2026 Annual Report',
        }),
        card('bookmark', {
          url: 'https://vibress.org',
          title: 'Vibress Foundation',
          description: 'Open creator platforms for independent journalism.',
        }),
        card('callout', {
          emoji: '💡',
          text: 'Remember to verify your publication settings before going live.',
        }),
        card('toggle', {
          title: 'Is my data preserved?',
          content: 'Yes, Vibress Studio implements strict zero-loss AST normalization.',
        }),
        card('button', {
          text: 'Subscribe Now',
          url: 'https://example.com/subscribe',
        }),
        card('embed', {
          url: 'https://youtube.com/watch?v=12345',
          caption: 'Watch on YouTube',
        }),
        card('divider', {}),
        card('unknown-card', {}),
      ])
    );

    // Image with caption
    expect(md).toContain('![Banner image](https://example.com/banner.png)\n*Editorial photo by Jane Doe*');

    // Gallery
    expect(md).toContain('![Shot 1](https://example.com/1.jpg)');
    expect(md).toContain('![Shot 2](https://example.com/2.jpg)');
    expect(md).toContain('*Trip to Kyoto*');

    // Video
    expect(md).toContain('[▶ Platform Walkthrough](https://example.com/demo.mp4)');

    // Audio
    expect(md).toContain('[🎵 Episode 42: Building Editors](https://example.com/podcast.mp3)');

    // File
    expect(md).toContain('[📎 2026 Annual Report](https://example.com/annual-report.pdf)');

    // Bookmark
    expect(md).toContain('[Vibress Foundation](https://vibress.org)\n> Open creator platforms for independent journalism.');

    // Callout
    expect(md).toContain('> 💡 Remember to verify your publication settings before going live.');

    // Toggle
    expect(md).toContain('<details><summary>Is my data preserved?</summary>\n\nYes, Vibress Studio implements strict zero-loss AST normalization.\n\n</details>');

    // Button
    expect(md).toContain('[Subscribe Now](https://example.com/subscribe)');

    // Embed
    expect(md).toContain('[Watch on YouTube](https://youtube.com/watch?v=12345)');

    // Divider
    expect(md).toContain('---');

    // Unknown card
    expect(md).toContain('[Card: unknown-card]');
  });

  it('preserves Arabic and mixed-direction documents during export', () => {
    const md = studioDocumentToMarkdown(
      doc([
        {
          type: 'heading',
          tag: 'h1',
          direction: 'rtl',
          children: [{ type: 'text', text: 'دليل النشر والتحرير' }],
        },
        {
          type: 'paragraph',
          direction: 'rtl',
          children: [
            { type: 'text', text: 'مرحباً بكم في منصة ' },
            { type: 'text', text: 'Vibress Studio', format: 1 },
            { type: 'text', text: ' للنشر الرقمي المستقل.' },
          ],
        },
      ])
    );

    expect(md).toContain('# دليل النشر والتحرير');
    expect(md).toContain('مرحباً بكم في منصة **Vibress Studio** للنشر الرقمي المستقل.');
  });
});
