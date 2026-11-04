# Vibress Studio — Import, Export, and Format Conversion

Vibress Studio provides robust, deterministic transformation between its canonical document AST (`vibress-studio` schema version 1), HTML, and GitHub Flavored Markdown (GFM).

This document establishes the **authoritative Loss Matrix and conversion boundaries** across HTML import, Markdown import, and Markdown export, resolving finding **STU-R12**.

---

## 1. Document Architecture & Conversion Guarantees

- **Canonical Schema:** Persisted and runtime state uses schema `vibress-studio`, version `1`.
- **Zero Content Loss:** Content is never silently dropped, wiped, or truncated during conversion.
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
| **Code Block** | ````lang\ncode\n```` | **Lossless:** Preserves language identifier. |
| **Link** | `[Label](url)` | **Safe & Lossless:** Validates URL protocol; escapes label `[` and `]`, percent-encodes spaces, escapes parentheses in URL. |
| **Table** | `\| H1 \| H2 \|\n\| --- \| --- \|\n\| C1 \| C2 \|` | **Semantic Fallback:** Emits standard GFM table. Cell formatting (spans, cell colors) is flattened. Newlines within cells are converted to `<br />`. |
| **Direction (RTL / LTR)** | Emits clean text | **Lossy:** Standard Markdown does not have native block direction syntax. Unicode bidirectional marks and script detection govern client display. |
| **Divider Card** | `---` | **Lossless:** Standard Markdown thematic break. |
| **Markdown Card** | `cardData.markdown` | **Lossless:** Literal Markdown string. |
| **HTML Card** | `cardData.html` | **Preserved:** Emits stored sanitized HTML string. |
| **Image Card** | `![alt](src)` followed by `*caption*` if present | **Semantic Fallback:** Image URL and alt text survive losslessly. Layout widths (`wide`, `full`) and intrinsic pixel dimensions are omitted. |
| **Gallery Card** | Sequence of `![alt](src)` followed by `*caption*` | **Semantic Fallback:** Every image in the gallery is emitted as an individual Markdown image link. |
| **Video Card** | `[▶ Caption](src)` | **Semantic Fallback:** Safe link with player affordance indicator. |
| **Audio Card** | `[🎵 Title](src)` | **Semantic Fallback:** Safe link with audio affordance indicator. |
| **File Card** | `[📎 Title](src)` | **Semantic Fallback:** Safe download link with attachment affordance indicator. |
| **Bookmark Card** | `[Title](url)` followed by `> Description` | **Semantic Fallback:** Rich preview card decomposes to primary link and blockquote description. |
| **Callout Card** | `> emoji text` | **Semantic Fallback:** Converts to Markdown blockquote, preserving callout emoji and multi-line body. Color theme is omitted. |
| **Toggle Card** | `<details><summary>Title</summary>\n\nContent\n\n</details>` | **Lossless HTML Extension:** Uses standard semantic HTML disclosure widget supported by all major Markdown renderers. |
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
| `<figure>` with `<img>` & `<figcaption>` | `studio-card` (`image`) | Extracts `src`, `alt`, and `caption` into card data. |
| `<details>` with `<summary>` | `studio-card` (`toggle`) | Extracts summary text as `title` and details body as `content`. |
| `<br>` | `linebreak` | Hard line break. |
| `dir="rtl"` / `dir="ltr"` | `direction: "rtl" \| "ltr"` | Propagated down tree to ensure bilingual fidelity. |

---

## 4. Verification and Regression Testing

The import and export conversions are verified in the following automated test suites:
- `packages/studio-markdown/src/__tests__/markdown-export.test.ts`: GFM tables, checklists, code blocks, card fallbacks, and RTL export.
- `packages/studio-testing/security/markdown-security.test.ts`: Malicious URLs, escaping, and protocol injection.
- `tests/html-import-regressions.test.ts`: Complex nested HTML, tables, bidirectional text, and figure/details parsing.
- `e2e/specs/06-import-export.spec.ts`: End-to-end browser import/export round-trip workflows.
