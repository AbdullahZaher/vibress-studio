import { StudioDocument } from '@vibress/studio-core';

export const XSS_TEST_PAYLOADS = [
  '<script>alert(1)</script>',
  '<img src="x" onerror="alert(1)">',
  '<a href="javascript:alert(1)">Click me</a>',
  '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
  '<div onclick="alert(1)">Click</div>',
];

export function createTestStudioDocument(): StudioDocument {
  return {
    schema: 'vibress-studio',
    version: 1,
    editor: { lexicalVersion: '0.13.1' },
    root: {
      type: 'root',
      children: [
        {
          type: 'heading',
          tag: 'h1',
          children: [{ type: 'text', text: 'Welcome to Vibress Studio', format: 0, mode: 'normal', version: 1 }],
          version: 1,
        },
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: 'This is a ', format: 0, mode: 'normal', version: 1 },
            { type: 'text', text: 'bold', format: 1, mode: 'normal', version: 1 },
            { type: 'text', text: ' and ', format: 0, mode: 'normal', version: 1 },
            { type: 'text', text: 'italic', format: 2, mode: 'normal', version: 1 },
            { type: 'text', text: ' paragraph.', format: 0, mode: 'normal', version: 1 },
          ],
          version: 1,
        },
        {
          type: 'studio-card',
          cardType: 'image',
          cardData: { src: 'https://example.com/test.jpg', alt: 'Test Image', caption: 'Sample Caption' },
          version: 1,
        },
      ],
      version: 1,
    },
  };
}

export function createStressTestStudioDocument(paragraphCount = 200): StudioDocument {
  const children: unknown[] = [
    {
      type: 'heading',
      tag: 'h1',
      children: [{ type: 'text', text: `Stress Test Document (${paragraphCount} Paragraphs)`, format: 0, mode: 'normal', version: 1 }],
      version: 1,
    },
  ];

  for (let i = 1; i <= paragraphCount; i++) {
    children.push({
      type: 'paragraph',
      children: [
        { type: 'text', text: `Paragraph ${i}: `, format: 1, mode: 'normal', version: 1 },
        { type: 'text', text: `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Section ${i} contents.`, format: 0, mode: 'normal', version: 1 },
      ],
      version: 1,
    });

    if (i % 50 === 0) {
      children.push({
        type: 'studio-card',
        cardType: 'callout',
        cardData: { text: `Milestone Callout at paragraph ${i}`, emoji: '🚀', backgroundColor: 'blue' },
        version: 1,
      });
    }
  }

  return {
    schema: 'vibress-studio',
    version: 1,
    editor: { lexicalVersion: '0.13.1' },
    root: {
      type: 'root',
      children: children,
      version: 1,
    },
  };
}

/** Deterministic synthetic workloads, not production article samples. */
export function createBenchmarkStudioDocument(scenario: string): StudioDocument {
  const counts: Record<string, number> = {
    empty: 0, '1000-words': 1000, '5000-words': 5000, '20000-words': 20000,
    'mixed-5000': 5000, 'table-5000': 5000, 'media-5000': 5000,
  };
  if (!Object.prototype.hasOwnProperty.call(counts, scenario)) throw new Error('UNKNOWN_STUDIO_BENCHMARK_SCENARIO');
  const count = counts[scenario] ?? 0;
  const document: StudioDocument = { schema: 'vibress-studio', version: 1, root: { type: 'root', version: 1, children: [] } };
  for (let offset = 0; offset < count; offset += 100) {
    const words = Array.from({ length: Math.min(100, count - offset) }, (_, index) =>
      scenario === 'mixed-5000' && index % 2 === 0 ? 'العربية' : 'publishing');
    document.root.children.push({ type: 'paragraph', version: 1, children: [
      { type: 'text', version: 1, text: words.join(' '), format: 0, mode: 'normal' },
    ] });
  }
  if (scenario === 'table-5000') {
    document.root.children.push({ type: 'table', version: 1, children: Array.from({ length: 60 }, (_, row) => ({
      type: 'tablerow', version: 1, children: Array.from({ length: 6 }, (_, column) => ({
        type: 'tablecell', version: 1, headerState: row === 0 ? 1 : 0, children: [{
          type: 'paragraph', version: 1, children: [{ type: 'text', version: 1, text: `Cell ${row} ${column}` }],
        }],
      })),
    })) });
  }
  if (scenario === 'media-5000') {
    for (let index = 0; index < 50; index++) document.root.children.push({
      type: 'studio-card', version: 1, cardType: 'image',
      cardData: { assetId: `benchmark-${index}`, src: `/mock/assets/${index}`, alt: `Image ${index}`, caption: '' },
    });
  }
  if (!document.root.children.length) document.root.children.push({ type: 'paragraph', version: 1, children: [] });
  return document;
}
