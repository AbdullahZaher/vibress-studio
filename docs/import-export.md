# Vibress Studio — Import, Export, and Format Conversion

Vibress Studio provides robust, deterministic transformation between its canonical document AST (`vibress-studio` schema version 1), HTML, and GitHub Flavored Markdown (GFM).

This document establishes the **authoritative Loss Matrix and conversion boundaries** across HTML import, Markdown import, and Markdown export, resolving finding **STU-R12**.

---

## 1. Document Architecture & Conversion Guarantees

- **Canonical Schema:** Persisted and runtime state uses schema `vibress-studio`, version `1`.
- **Explicitly Lossy Conversion:** The canonical document is preserved in Studio; HTML/Markdown conversions can omit layout, unknown nodes and unsupported card data. Never overwrite the original persisted document using a lossy export.
- **Strict Allowlisted Sanitization:** Untrusted HTML and Markdown input is sanitized using strict allowlists (`sanitizeHtml`, `parseMarkdownToHtml`, `isSafeUrl`, `escapeMarkdownUrl`). Executable URLs (`javascript:`, `vbscript:`, `data:text/html`), raw script tags, and malicious event handlers are rejected at the boundary.
- **Safe Fallbacks:** Elements or cards that cannot be represented natively in plain Markdown degrade deterministically to readable semantic text representations.

---

## 2. Markdown Export Loss Matrix (`studioDocumentToMarkdown`)

The following matrix documents the exact transformation applied when exporting a `StudioDocument` to Markdown:

| AST Element / Card | Markdown Export Output | Fidelity & Conversion Status |
| :--- | :--- | :--- |
| **Paragraph** | Plain text / inline formatted text | **Lossless** |
| **Heading (h1–h6)** | `# Heading` through `###### Heading` | **Lossless** |
| **Inline Formatting** | `**bold**`, `*italic*`, `~~strike~~`, `` `code` `` | **Lossless** (Lexical bitmask 1, 2, 4, 16) |
| **Text Colors & Highlights** | Rendered as text without inline style | **Intentionally Lossy:** Standard Markdown has no inline style syntax. Colors survive to HTML renderer but not Markdown. |
| **Bullet List** | `- Item` | **Lossless** |
| **Numbered List** | `1. Item`, `2. Item` | **Lossless:** Preserves ordinal sequence numbers. |
| **Checklist** | `- [ ] Pending`, `- [x] Completed` | **Lossless:** Standard GFM task list syntax. |
| **Blockquote** | `> Quote text` | **Lossless** |
| **Code Block** | ````lang\ncode\n```` | **Lossless & Secure:** Preserves sanitized language identifier; dynamically expands fence length when code contains backticks to prevent premature escape. |
| **Link** | `[Label](url)` | **Safe & Lossless:** Validates URL protocol; escapes label `[` and `]`, percent-encodes spaces, escapes parentheses in URL. |
| **Table** | `\| H1 \| H2 \|\n\| --- \| --- \|\n\| C1 \| C2 \|` | **Semantic Fallback:** Emits standard GFM table. Cell formatting (spans, cell colors) is flattened. Newlines within cells are converted to `<br />`. |
| **Direction (RTL / LTR)** | Emits clean text | **Lossy:** Standard Markdown does not have native block direction syntax. Unicode bidirectional marks and script detection govern client display. |
| **Divider Card** | `---` | **Lossless:** Standard Markdown thematic break. |
| **Markdown Card** | `sanitizeHtml(cardData.markdown)` | **Lossless & Secure:** Preserves Markdown syntax while sanitizing embedded raw HTML tags against injection. |
| **HTML Card** | Safe readable text or `[Card: html]` | **Lossy/Safe:** Never emits raw untrusted HTML card markup into Markdown. |
| **Image Card** | `![alt](src)` or `[![alt](src)](href)` followed by `*caption*` if present | **Semantic Fallback:** Image URL, alt text, hyperlink, and caption survive losslessly. Layout widths (`wide`, `full`) and intrinsic pixel dimensions are omitted. |
| **Gallery Card** | Sequence of `![alt](src)` followed by `*caption*` | **Semantic Fallback:** Every image in the gallery is emitted as an individual Markdown image link. |
| **Video Card** | `[▶ Caption](src)` | **Semantic Fallback:** Safe link with player affordance indicator. |
| **Audio Card** | `[🎵 Title](src)` | **Semantic Fallback:** Safe link with audio affordance indicator. |
| **File Card** | `[📎 fileName](src)` | **Semantic Fallback:** Safe download link with attachment affordance indicator. |
| **Bookmark Card** | `[Title](url)` followed by `> Description` | **Semantic Fallback:** Rich preview card decomposes to primary link and blockquote description. |
| **Callout Card** | `> emoji text` | **Semantic Fallback:** Converts to Markdown blockquote, preserving callout emoji and multi-line body. Color theme is omitted. |
| **Toggle Card** | `<details><summary>heading</summary>…</details>` | **Lossy/Safe:** Encodes heading and content; requires a Markdown consumer that permits controlled HTML, otherwise renders literal markup. |
| **Button Card** | `[Text](url)` | **Semantic Fallback:** Emits accessible Markdown link. |
| **Embed Card** | `[Caption or Embed: url](url)` | **Semantic Fallback:** Emits verified provider link. |
| **Unknown / Custom Card** | `[Card: cardType]` | **Safe Indicator:** Does not drop or crash; surfaces card identity. |

---

## 3. HTML Import Mapping (`htmlToStudioDocument`)

When importing arbitrary or sanitized HTML into a `StudioDocument`:

| Incoming HTML Element | Mapped Studio Node | Processing Rules |
| :--- | :--- | :--- |
| `<p>` | `paragraph` | Inlines collected into paragraph node. |
| `<h1>` – `<h6>` | `heading` with `tag: h1` – `h6` | Retains level and direction. |
| `<strong>`, `<b>` | `text` with `format \|= 1` | Bold formatting bitmask. |
| `<em>`, `<i>` | `text` with `format \|= 2` | Italic formatting bitmask. |
| `<s>`, `<del>`, `<strike>` | `text` with `format \|= 4` | Strikethrough formatting bitmask. |
| `<u>` | `text` with `format \|= 8` | Underline formatting bitmask. |
| `<code>` | `text` with `format \|= 16` | Inline code formatting bitmask. |
| `<a>` | `link` | URL sanitized via `isSafeUrl`. |
| `<blockquote>` | `quote` | Blockquote container. |
| `<ul>`, `<ol>` | `list` with `listType: bullet \| number` | Retains `start` attribute on ordered lists. |
| `<li>` | `listitem` | Preserves nested lists. |
| `<pre>` | `code` | Code block container. |
| `<hr>` | `studio-card` (`divider`) | Horizontal separator card. |
| `<table>` | `table` with `tablerow` & `tablecell` | Retains header cells (`<th>`), row/col spans (bounded positive integers 1–1000), cell and table `dir` attributes. Empty cells receive empty paragraphs. |
| `<figure>` with `<img>` & `<figcaption>` | `studio-card` (`image`) | Extracts `src`, `alt`, optional `href` (if wrapped in `<a>`), layout width (`wide`/`full` or numeric), and rich `<figcaption>` content as both plain `caption` and sanitized `captionHtml`. |
| `<figure class="kg-gallery-card">` | `studio-card` (`gallery`) | Extracts gallery image items, alt text, layout width, and rich caption. |
| `<figure class="kg-video-card">` | `studio-card` (`video`) | Extracts video `src`, `poster`, layout width, and caption. |
| `<div class="kg-callout-card">` | `studio-card` (`callout`) | Extracts callout text, emoji, and background color theme. |
| `<div class="kg-button-card">` | `studio-card` (`button`) | Extracts button text, destination URL, and alignment. |
| `<figure class="kg-bookmark-card">` | `studio-card` (`bookmark`) | Extracts bookmark URL, title, and description. |
| `<details>` with `<summary>` | `studio-card` (`toggle`) | Extracts summary text as `heading` and details body as `content`. |
| `<br>` | `linebreak` | Hard line break. |
| `dir="rtl"` / `dir="ltr"` | `direction: "rtl" \| "ltr"` | Propagated down tree to ensure bilingual fidelity. |

---

## 4. Verification and Regression Testing

The import and export conversions are verified in the following automated test suites:
- `packages/studio-markdown/src/__tests__/markdown-export.test.ts`: GFM tables, checklists, code fences with backtick expansion, language sanitization, card fallbacks, and RTL export.
- `packages/studio-testing/security/markdown-security.test.ts`: Malicious URLs, escaping, and protocol injection.
- `tests/html-import-regressions.test.ts`: Complex nested HTML, tables, bidirectional text, and figure/details parsing.
- `tests/html-roundtrip.test.ts`: Bidirectional round-trip fidelity between HTML and StudioDocument across all card types and rich captions.
- `packages/studio-renderer/src/__tests__/renderer.test.ts`: HTML and plain-text output, deterministic heading IDs matching Table of Contents, and structured plain-text formatting for tables and lists.
- `e2e/specs/06-import-export.spec.ts`: End-to-end browser import/export round-trip workflows.
