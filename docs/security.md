# Vibress Studio — Security

This document describes the security model and guarantees of Vibress Studio.

> Also read: [Threat Model](security/threat-model.md), [XSS Regression Matrix](security/xss-regression-matrix.md), [Sanitization Policy](sanitization-policy.md).

## Security guarantees

1. **No raw HTML rendering.** Every renderer (server HTML, plain text, React
   preview, import paths) treats all input as untrusted. User-provided HTML
   is only ever emitted after allowlist sanitization; text is escaped;
   URLs are protocol-checked and attribute-escaped.
2. **Allowlist sanitizer only.** The regex-based sanitizer was removed
   (hardening P1). `sanitizeHtmlFragment` in `@vibress/studio-utils` is the
   single sanitizer, backed by `sanitize-html` with an explicit policy in
   `packages/studio-utils/src/sanitize/policy.ts`.
3. **Safe HTML card.** The HTML card never emits raw HTML: its renderer
   sanitizes through the same allowlist (Option B). There is no trusted raw
   path by default.
4. **Provider-allowlisted embeds.** The embed card emits `<iframe>` only for
   allowlisted providers (YouTube, Vimeo, Spotify, SoundCloud, CodePen,
   CodeSandbox, Twitter/X, Figma). Everything else degrades to a safe link.
5. **Branded SafeHtml boundary.** In React, `dangerouslySetInnerHTML` exists
   only in `SafeHtml`, which accepts exclusively `SanitizedHtml` values
   created by `sanitizeToSafeHtml`.
6. **Validated card data.** Every card schema is validated with Zod before
   rendering (URL protocols, safe class tokens, numeric dimensions).
7. **Server-safe renderer packages.** `studio-core`, `studio-cards`,
   `studio-utils`, `studio-html`, `studio-markdown`, `studio-renderer`,
   `studio-serializer`, and `studio-plugin-sdk` never import React or
   Lexical (enforced by `pnpm verify:package-exports`).

## Guaranteed-safe rendering path

```ts
import { renderStudioDocumentToHtml } from '@vibress/studio-renderer';

// SSR-safe: output contains no scripts, event handlers, or unsafe URLs.
const html = renderStudioDocumentToHtml(storedDocument);
```

The document renderer:

- escapes text nodes with `escapeHtml`;
- validates/escapes every `href`/`src` with `sanitizeUrl` + `escapeAttribute`;
- renders cards through their sanitizing definitions;
- never emits `javascript:`, `vbscript:`, `data:text/html`,
  `data:image/svg+xml`, event handlers, or `srcdoc`.

## Renderer responsibilities

| Layer | Responsibility |
|---|---|
| `escapeHtml` | text nodes |
| `escapeAttribute` | attribute values |
| `sanitizeUrl` / `isSafeUrl` | URL protocols + attribute breakout |
| `sanitizeHtmlFragment` | HTML fragments (captions, embed html, markdown output, HTML card) |
| `SafeHtml` | React `dangerouslySetInnerHTML` boundary |
| Zod schemas | card data shape, dimensions, class tokens |

## Known limitations

- **Email rendering**: `renderStudioDocumentToHtml` with `target: 'email'`
  currently shares the web policy; some CMS email features (e.g. tracking
  pixels) are out of scope.
- **SVG images**: `data:image/svg+xml` is rejected everywhere because SVG
  can carry scripts. Hosting SVG assets requires a separate, dedicated
  sanitizer/allowlist service.
- **Trusted raw HTML**: not exposed. If a future requirement needs it, it
  must add an explicit trusted-author path with server-side permission
  checks, audit logging, and CSP validation — disabled by default.

## Reporting a vulnerability

Open an issue in the repository with the package, affected version, payload,
and expected vs actual output.
