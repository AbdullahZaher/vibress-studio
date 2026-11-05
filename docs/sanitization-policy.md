# Vibress Studio — Current HTML Sanitization Policy

**Source of truth:** `packages/studio-utils/src/sanitize.ts` at the reviewed revision. This policy is implemented using the **parse5 HTML parser**; the former `sanitize-html` library, `sanitizeHtmlFragment` function and `HTML_SANITIZE_POLICY` configuration API do **not** exist in this source revision.

## HTML entry points

```ts
import { sanitizeStudioHtml, getEmbedProvider } from '@vibress/studio-utils';

const safeFragment = sanitizeStudioHtml(untrustedHtml);
const provider = getEmbedProvider(userSuppliedEmbedUrl); // YouTube or Vimeo, or null
```

`sanitizeHtml` is also exported as a delegating convenience function. `renderStudioDocumentToHtml` applies the shared sanitizer at its final public-output boundary. Use validation, escaping and sanitization at **each** untrusted data boundary, including plugin/card output; do not rely solely on sanitizing during import.

## Policy shape

The sanitizer uses allowlisted HTML tags and **per-tag/global attributes**. Source constants `STUDIO_ALLOWED_TAGS` and the attribute map in `sanitize.ts` define the exact current list; tests in `packages/studio-utils/src/__tests__/sanitize.test.ts` verify script/event-handler stripping, malformed HTML handling and protocol rules.

- It rejects `script` execution vectors, `on*` handlers and arbitrary inline `style` attributes.
- Anchor `target="_blank"` receives safe rel protection.
- Iframes survive **only** with an approved YouTube/Vimeo provider URL. Arbitrary `srcdoc`, executable iframe URLs and unknown providers are disallowed.
- `blob:`, `javascript:`, `vbscript:`, SVG data images and other executable destinations are rejected for published output.
- For narrowly permitted image destinations, the sanitizer recognizes raster `data:image/` formats. **Never store base64, data or object URLs as durable media refs**; the host provides permanent assets.
- The sanitizer permits some semantic elements such as controlled `button` and `input` forms for supported output (e.g., checklists). Those elements do not grant interactive behavior; published copy/share actions need an explicit functional host contract.
- The permitted attributes and providers are not a public invitation to extend sanitizer rules at runtime. Policy changes require code review and targeted XSS tests.

## Security Hardening and Remediation Status

1. **Markdown Link Security (STU-R05 — Resolved):** `studioDocumentToMarkdown` enforces strict URL validation using the shared URL policy, stripping dangerous protocols (`javascript:`, `vbscript:`, `data:` except safe images), and escapes Markdown link syntax (`]`, `)`, whitespace). Covered in `packages/studio-testing/security/markdown-security.test.ts`.
2. **Text Style Allowlist (STU-R04 — Resolved):** Color and highlight styles use strict allowlisted format rules (hex, rgb, hsl, CSS color names) in `packages/studio-renderer/src/index.ts` to prevent arbitrary CSS injection, verified in `packages/studio-renderer/src/__tests__/renderer.test.ts`.
3. **Plugin Sanitization (STU-R13 — Resolved):** Plugin card rendering is mediated by `StudioPluginRegistry.renderCardHtml` which applies `sanitizeStudioHtml` to all plugin-generated HTML, preventing stored XSS from untrusted plugin outputs. Verified in `tests/studio-plugin-registry.test.ts`.
4. **Sanitizer Coverage Maintenance:** HTML sanitizer coverage is continuously verified by `packages/studio-utils/src/__tests__/sanitize.test.ts`, `packages/studio-testing/security/content-security.test.ts`, and Playwright E2E spec `05-html-card-xss.spec.ts`.

**Do not use examples from superseded docs** that import `sanitizeHtmlFragment`, `HTML_SANITIZE_POLICY`, or a missing `sanitize/policy.ts` file.
