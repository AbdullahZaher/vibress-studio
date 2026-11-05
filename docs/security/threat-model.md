# Vibress Studio — Security Threat Model

Status: maintained as part of the 10/10 production hardening program.
Scope: the `@vibress/*` editor, renderer, import/export, and plugin packages.

## 1. Trust model

| Input | Trust level | Example |
|---|---|---|
| Document authored by an admin in the Vibress editor | trusted-ish (still validated) | `StudioDocument` JSON |
| Arbitrary HTML pasted into an HTML card | **untrusted** | `<script>`, `<iframe srcdoc>` |
| Markdown pasted/imported | **untrusted** | `[x](javascript:alert(1))` |
| HTML imported from another CMS | **untrusted** | legacy export dumps |
| Card `cardData` persisted in the DB | untrusted (may be tampered) | `src`, `captionHtml`, `url` |
| Third-party plugin renderers | **untrusted by default** | plugin `registerCard` |
| Uploaded files | untrusted | media binaries + metadata |
| URLs in `href`/`src` | untrusted | `javascript:`, `data:image/svg+xml` |

**Core rule:** every renderer must treat all of its inputs as untrusted and
apply the appropriate sanitization/escaping layer before emitting HTML.

## 2. Attack surface inventory

| Surface | Input source | Output path |
|---|---|---|
| HTML card | user HTML | public renderer, React preview |
| Embed card | user HTML/URL | public renderer, React preview |
| Bookmark card | URL + metadata | public renderer, React editor |
| Image card | src/alt/caption/captionHtml | public renderer, editor |
| Gallery card | image array + captions | public renderer |
| Video/audio cards | media URL, poster, title | public renderer |
| File card | src, fileName | public renderer |
| Button card | url, text | public renderer |
| Callout/toggle cards | text/content | public renderer |
| Markdown card | markdown string | public renderer |
| Markdown import/export | markdown | document → renderer |
| HTML import | HTML | document → renderer |
| React preview rendering | document | browser DOM |
| Server-side HTML rendering | document | SSR HTML string |
| Plugin-provided cards | plugin data/renderer | public renderer |
| Card attributes | cardData fields | element attributes |
| URLs | href/src/poster | element attributes |
| Inline styles/classes | cardData | class attributes |
| Captions/alt text/titles | cardData | text nodes / attributes |

## 3. Field classification

| Field | Class | Renderer treatment |
|---|---|---|
| `text`, `alt`, `title`, `fileName`, `heading`, `emoji`, `author`, `publisher` | plain text | `escapeHtml` at render time |
| `description`, `caption` (string) | plain text | `escapeHtml` at render time |
| `captionHtml` | HTML | allowlist `sanitizeHtml` at render time |
| `src`, `href`, `url`, `poster`, `thumbnail`, `icon` | URL | `sanitizeUrl` + attribute escaping |
| `html` (HTML card), `html` (embed) | HTML | allowlist `sanitizeHtml` (HTML card = Option B strict) |
| `markdown` (markdown card) | Markdown | `markdownIt(html:false)` + `sanitizeHtml` after conversion |
| `cardData` payloads | JSON data | Zod schema validation before render |
| `width`, `height`, `loop`, `autoplay` | trusted system value | Zod-constrained types |
| `embedType`, `style`, `alignment`, `backgroundColor` | trusted system value | Zod enums (no free-form CSS) |

## 4. Renderer-by-renderer security contract

### 4.1 `renderStudioDocumentToHtml` (server-safe renderer)

- input source: `StudioDocument` (or legacy JSON, migrated).
- sanitization layer: card definitions validate with Zod and sanitize URLs/HTML.
- escaping layer: `escapeHtml` for text nodes and attribute values.
- allowed tags (emitted): `p, h1-h6, blockquote, ul, ol, li, a, pre, code,
  strong, em, s, u, figure, figcaption, img, video, audio, div, span, hr,
  details, summary, iframe (embed card, provider allowlist only)`.
- allowed attributes: per card policy (see `sanitization-policy.md`).
- allowed protocols: `http:`, `https:`, `mailto:`, `tel:`, relative paths,
  `data:image/png|jpeg|gif|webp`, `blob:` (preview only, never persisted).
- test coverage: `packages/studio-testing/security/xss-payloads.test.ts`,
  `packages/studio-renderer/...` renderer tests.

### 4.2 React preview / editor rendering

- input source: card `cardData` from the live document.
- boundary: Studio's HTML-bearing React card paths call the shared `sanitizeStudioHtml` allowlist; there is no branded `SafeHtml` component in this revision. Never render untrusted card HTML without sanitization.
- embedding: preview and server card rendering use `resolveStudioEmbedDestination` (YouTube/Vimeo iframe or safe external link). Legacy raw embed HTML is not published.

### 4.3 HTML import (`htmlToStudioDocument`)

- input source: arbitrary HTML.
- sanitization layer: parsed with a real HTML parser (`parse5`), allowlist
  policy applied, then mapped to Studio nodes.
- never emits raw HTML into `captionHtml`/`html` card data unless sanitized.

### 4.4 Markdown import/export

- import: `markdown-it` with `html: false`; links sanitized after conversion.
- export: document → Markdown; unsupported cards use the readable `[Card: cardType]` fallback. Format conversion is intentionally lossy for unsupported layout and card fields.

### 4.5 Plugin-provided cards

- `StudioPluginRegistry.renderCardHtml` sanitizes plugin HTML through the shared allowlist. There is no trusted `raw-html` bypass or plugin execution sandbox.

## 5. Deny list (never allowed through any renderer)

- `<script>`, `<iframe>` (except validated provider URLs), `<object>`, `<embed>`,
  `<form>`, `<svg>`, `<math>`, `<style>`, `<link>`, `<meta>`,
  `<base>`, `<template>`, `<frameset>`, `<frame>`. Checkbox `input` and inert `button` elements are allowed with restricted attributes.
- event handler attributes (`on*`).
- `srcdoc` and `background` attributes. The `style` attribute is accepted only after strict allowlisted property/value sanitization.
- protocols: `javascript:`, `vbscript:`, `data:text/html`,
  `data:image/svg+xml`, `file:`.
- CSS `url()` with dangerous protocols (stripped via style removal).

## 6. Trusted-only path (future, disabled by default)

The HTML card renders only *sanitized* HTML (Option B). A fully trusted raw
path is **not** exposed; if introduced later it must require: trusted author
role, server-side permission check, audit log, visible warning in the editor,
and strict CSP compatibility.

## 7. Threat scenarios → mitigations

| Threat | Mitigation |
|---|---|
| Stored XSS via HTML card | allowlist sanitizer, tested regression matrix |
| Stored XSS via captionHtml | `captionHtml` sanitized, never raw |
| `javascript:` href/src injection | `sanitizeUrl` + attribute escaping |
| Attribute breakout (`" onerror=...`) | `escapeAttribute` on every attribute value |
| Embed iFrame abuse | provider allowlist, unsupported → safe link |
| Malformed URLs crash renderer | try/catch + `sanitizeUrl` fallback |
| Object-URL memory leak | `URL.revokeObjectURL` on replace/cleanup |
| Plugin XSS | host sanitizes plugin output; capability gating |
| Regex bypass (sanitizer) | no regex-only sanitization in production paths |
| Import parser confusion | real HTML parser (`parse5`) for HTML import |
