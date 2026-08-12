# Vibress Studio — Cards

Card definitions live in `@vibress/studio-cards`. A card is a Zod-validated
data schema plus HTML and plain-text renderers that are safe by default.

## Built-in cards

| Type | Schema fields (highlights) | Renderer guarantees |
|---|---|---|
| `image` | `src*`, `alt`, `caption(html)`, `width`, `height`, `href` | URL + attr escaping, lazy loading, numeric dimensions, no SVG data URLs |
| `gallery` | `images[]`, `caption(html)`, `width` | every image sanitized/escaped, max 50 items |
| `video` | `src*`, `poster`, `loop`, `autoplay`, `caption` | no autoplay unless configured (then muted + playsinline), safe poster |
| `audio` | `src*`, `title`, `caption` | escaped title, `preload="metadata"` |
| `file` | `src*`, `fileName`, `fileSize`, `caption` | escaped name, safe download link |
| `bookmark` | `url*`, `title`, `description`, `author`, `publisher`, `thumbnail`, `icon` | all fields escaped; malformed URLs degrade safely |
| `embed` | `url*`, `html`, `caption` | provider allowlist for iframes; otherwise sanitized HTML or safe link |
| `button` | `text*`, `url*`, `alignment` | escaped label, `rel="noopener noreferrer"` |
| `callout` | `text*`, `emoji`, `backgroundColor` | escaped text, safe class token |
| `toggle` | `heading*`, `content*` | escaped heading/content |
| `markdown` | `markdown*` | markdown-it (`html: false`) + sanitized after conversion |
| `html` | `html*` | **strict allowlist sanitization — never raw** (Option B) |
| `divider` | `style` | `<hr />` only |

`*` = required by the Zod schema.

## Card definition contract

```ts
interface StudioCardDefinition<TData> {
  type: string;
  version: number;
  validate(data: unknown): TData;      // Zod, throws on invalid
  renderHtml(data: TData): string;     // always safe output
  renderPlainText(data: TData): string;
}
```

`renderHtml` must produce sanitizer-idempotent output:
`sanitizeHtmlFragment(renderHtml(d)) === renderHtml(d)`.

## Adding a custom card (host application)

```ts
import { z } from 'zod';
import { escapeHtml, sanitizeUrl } from '@vibress/studio-utils';

const MyCardSchema = z.object({ headline: z.string(), url: z.string() });

const myCard = {
  type: 'highlight',
  version: 1,
  validate: (d) => MyCardSchema.parse(d),
  renderHtml: ({ headline, url }) =>
    `<div class="highlight"><strong>${escapeHtml(headline)}</strong> <a href="${escapeAttribute(sanitizeUrl(url))}">more</a></div>`,
  renderPlainText: ({ headline }) => headline,
};
```

Rules:

- escape every text value (`escapeHtml`);
- validate and escape every URL (`sanitizeUrl` + `escapeAttribute`);
- never emit user HTML without `sanitizeHtmlFragment`;
- keep class names from fixed strings or validated tokens;
- register the card with the editor's card registry.

## Adding a custom card via plugin

See [Plugin SDK](plugin-sdk.md). Plugin cards default to
`host-sanitized` trust — the host sanitizes their output regardless of what
the plugin returns.

## Rendering cards

- Public HTML: `renderStudioDocumentToHtml(doc)`.
- Plain text: `renderStudioDocumentToPlainText(doc)`.
- Markdown: `studioDocumentToMarkdown(doc)`.
- In the editor, card editors render through `SafeHtml` (branded sanitized
  HTML) — never `dangerouslySetInnerHTML` directly.
