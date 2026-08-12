# Vibress Studio

Standalone, framework-agnostic rich-content editor for Vibress — a document
model, Lexical-based editing experience, and server-safe renderers
(HTML / plain text / Markdown) that share one validated schema.

## Packages

| Package | Purpose |
|---|---|
| `@vibress/studio-core` | Canonical `vibress-studio` document schema, validation, and migration (`unknown` → current version) |
| `@vibress/studio-cards` | Card definitions (image, gallery, video, audio, file, bookmark, embed, button, callout, toggle, markdown, html) with Zod-validated data and HTML/plain-text renderers |
| `@vibress/studio-html` | HTML import (`htmlToStudioDocument`) |
| `@vibress/studio-markdown` | Markdown export (`studioDocumentToMarkdown`) |
| `@vibress/studio-nodes` | Lexical node set for the editor (paragraph, heading, quote, list, link, code) |
| `@vibress/studio-plugin-sdk` | Plugin/card registration boundary |
| `@vibress/studio-react` | React editor (Lexical), card editors, and card components |
| `@vibress/studio-renderer` | Server-safe renderers: `renderStudioDocumentToHtml` / `renderStudioDocumentToPlainText` with URL/HTML sanitization |
| `@vibress/studio-serializer` | Document serialization helpers |
| `@vibress/studio-testing` | Test fixtures (XSS payloads, stress documents) |
| `@vibress/studio-transforms` | Document transforms |
| `@vibress/studio-utils` | Shared utilities (URL safety, HTML escaping, Markdown→HTML) |

## Requirements

- Node.js `>=24 <25`
- pnpm `>=11.17.0`

## Getting Started

```bash
pnpm install
pnpm dev        # run the playground (vite)
```

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit --prod
pnpm verify:explicit-any
```

CI runs lint, explicit-any guard, typecheck, tests, build, and a production
audit on every push to `main` and on pull requests (`.github/workflows/ci.yml`).

## Security properties

- Renderers escape text, sanitize URLs and HTML, and never execute scripts
  (`renderStudioDocumentToHtml` is safe for server-side SSR).
- URL validation blocks `javascript:`/`data:`/`vbscript:` schemes
  (`isSafeUrl` / `sanitizeUrl` in `@vibress/studio-utils`).
- XSS regression payloads live in `@vibress/studio-testing` and are exercised
  by the test suite.

## License

MIT — see [LICENSE](LICENSE).
