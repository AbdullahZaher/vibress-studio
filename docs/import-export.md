# Vibress Studio — Import / Export

Vibress Studio can import from and export to HTML and Markdown while keeping
content and cards safe.

## HTML import — `htmlToStudioDocument`

`@vibress/studio-html`

```ts
import { htmlToStudioDocument } from '@vibress/studio-html';

const doc = htmlToStudioDocument(htmlString);
```

Pipeline (hardening P6):

1. **Sanitize** with the allowlist policy (`sanitizeHtmlFragment`) — scripts,
   iframes, event handlers, and unsafe protocols never reach the parser.
2. **Parse** with `parse5` (WHATWG-spec parser — not regex).
3. **Map** to Studio nodes: paragraphs, headings, bold/italic/strike/code
   inline formatting, links, blockquotes, lists, code blocks, images,
   figures/captions, horizontal rules.

Unsupported or unsafe elements degrade to safe text or are dropped.

## Markdown import — `markdownToStudioDocument`

`@vibress/studio-markdown`

```ts
import { markdownToStudioDocument } from '@vibress/studio-markdown';

const doc = markdownToStudioDocument(markdownString);
```

- Parsed with `markdown-it` with `html: false` (raw HTML stays literal
  text).
- All links are URL-validated; `javascript:`/`vbscript:` links are not
  emitted as links.
- Card fences (see below) roundtrip into card nodes.

## Markdown export — `studioDocumentToMarkdown`

Native markdown for: paragraphs, headings, formatting, links, blockquotes,
lists, code blocks, images, dividers, markdown cards, image cards,
bookmark/link cards, embed links, callouts, toggles.

### Card fallback fence (deterministic)

Cards with no native markdown form (html, file, button, video, audio,
complex gallery data, plugin cards) export as:

```md
::vibress-card{type="gallery"}
{"images":[{"src":"https://example.com/1.jpg","alt":"one"}]}
::
```

This fence roundtrips through `markdownToStudioDocument` back into a card
node with the same `cardData`.

## Roundtrip guarantees

Tested in `packages/studio-testing/security/roundtrip.test.ts`:

- HTML → Studio → HTML preserves content.
- Markdown → Studio → Markdown preserves content.
- Studio → HTML → Studio preserves text content.
- Studio → Markdown → Studio preserves text content.
- Malicious HTML/markdown is sanitized on import.
- Cards survive roundtrips; unsupported cards degrade safely.

## Plain-text export

`renderStudioDocumentToPlainText(doc)` in `@vibress/studio-renderer`
extracts a plain-text view for search indexing or previews.
