# Vibress Studio — Import / Export (Current Contracts)

**Source-reviewed:** 2026-11-04. See [source audit](audits/studio-source-reassessment-2026-11-04.md) and [remediation PR A3/B4](roadmaps/global-ux-quality-roadmap.md#16-current-authoritative-remediation-and-development-plan--2026-11-04).

## HTML import

```ts
import { htmlToStudioDocument } from '@vibress/studio-html';
const doc = htmlToStudioDocument(untrustedHtmlString);
```

The implementation in `packages/studio-html/src/index.ts` calls the shared `sanitizeHtml` function (implemented by `sanitizeStudioHtml` using parse5), parses the cleaned HTML with parse5, and maps supported elements to Lexical-compatible Studio document nodes. The converter supports paragraphs/headings, inline formatting, links, lists, quotes, code, images, dividers, and table rows/cells with bounded spans and direction metadata. Unsupported markup may be flattened or dropped; exact DOM round-trip is **not** guaranteed.

## Markdown import

There is **no exported `markdownToStudioDocument` function** in the current `studio-markdown/src/index.ts`. The shared `parseMarkdownToHtml` helper is exported instead. To import Markdown into Studio using the current APIs, go through sanitized HTML import:

```ts
import { parseMarkdownToHtml } from '@vibress/studio-markdown';
import { htmlToStudioDocument } from '@vibress/studio-html';

const document = htmlToStudioDocument(parseMarkdownToHtml(untrustedMarkdown));
```

This pipeline is **lossy**; do not assume all Markdown constructs or card metadata are preserved. Validate and review outputs at the application boundary.

## Markdown export

```ts
import { studioDocumentToMarkdown } from '@vibress/studio-markdown';
const markdown = studioDocumentToMarkdown(document);
```

The current exporter maps basic paragraphs, headings, text marks, quotes, bullet-style list items, links, code blocks, divider cards and Markdown cards. Most other cards degrade to `[Card: type]`. It does **not** currently emit a JSON-backed `::vibress-card` fence. Numbered list type, nested structures, captions, tables, directions and rich media may be lost or flattened.

**Security limitation (`STU-R05`):** link destinations are currently interpolated directly as `[text](url)`, without an adequate shared URL-policy check or Markdown escaping. Treat exported Markdown as untrusted until the hardened path is implemented and verified. Do not directly interpret the output in privileged contexts.

## Public HTML / plain text

```ts
import {
  renderStudioDocumentToHtml,
  renderStudioDocumentToPlainText
} from '@vibress/studio-renderer';

const safeHtml = renderStudioDocumentToHtml(document);
const plainText = renderStudioDocumentToPlainText(document);
```

Public HTML output uses final `sanitizeStudioHtml`; do not assume all editor styles are emitted. Text color and highlight fidelity is tracked as `STU-R04`. Published renderer and editor parity must be tested independently.

## Verification required before claiming round-trip guarantees

- Valid/legacy/unknown v1 node fixtures save → reload without content loss.
- HTML and Markdown output preserve text meaning and safe URLs, documenting unsupported constructs.
- Style marks, captions, table direction and mixed Arabic/English content are checked both in JSON and in public HTML.
- Unsafe, malformed, escaped and nested Markdown URLs do not produce executable links on re-import.
- Renderer and import/export tests include deterministic lost-content reports rather than assuming equality for lossy formats.

Run `pnpm test:roundtrip`, `pnpm test:security`, `pnpm test` and browser import/export scenarios. See [testing inventory](testing.md).
