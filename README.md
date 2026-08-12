# Vibress Studio

Standalone, framework-agnostic rich-content editor for Vibress — a document
model, Lexical-based editing experience, and server-safe renderers
(HTML / plain text / Markdown) that share one validated schema.

Production-hardened: allowlist HTML sanitization, safe-by-default card
renderers, a branded React `SafeHtml` boundary, a media upload adapter
contract, parser-based import/export, a capability-gated plugin SDK, and
publish-ready packages.

## Packages

| Package | Purpose |
|---|---|
| `@vibress/studio-core` | Canonical `vibress-studio` document schema, validation, migration, and upload adapter contracts |
| `@vibress/studio-cards` | Card definitions (image, gallery, video, audio, file, bookmark, embed, button, callout, toggle, markdown, html, divider) with Zod-validated data and safe HTML/plain-text renderers |
| `@vibress/studio-renderer` | Server-safe renderers: `renderStudioDocumentToHtml` / `renderStudioDocumentToPlainText` |
| `@vibress/studio-html` | Allowlist sanitizer layer and HTML import (`htmlToStudioDocument`, parse5) |
| `@vibress/studio-markdown` | Markdown import/export (`markdownToStudioDocument` / `studioDocumentToMarkdown`) |
| `@vibress/studio-nodes` | Lexical node set (paragraph, heading, quote, list, link, code, StudioCardNode) — editor-side |
| `@vibress/studio-transforms` | Lexical node transforms — editor-side |
| `@vibress/studio-plugin-sdk` | Capability-gated plugin/card registration boundary |
| `@vibress/studio-react` | React editor (Lexical), card editors, `SafeHtml` boundary, media upload adapters |
| `@vibress/studio-serializer` | Document serialization helpers |
| `@vibress/studio-testing` | Test fixtures and security/a11y/perf suites |
| `@vibress/studio-utils` | Shared utilities: allowlist sanitizer implementation, URL safety, HTML escaping |

## Requirements

- Node.js `>=24 <25`
- pnpm `>=11.17.0`

## Getting Started

```bash
pnpm install
pnpm dev        # run the playground (vite)
```

## Using the editor

```tsx
import { VibressStudio } from '@vibress/studio-react';
import { VibressMediaUploadAdapter } from '@vibress/studio-react';

const adapter = new VibressMediaUploadAdapter({
  endpoint: 'https://api.yourhost.com/uploads',
  authorization: 'Bearer <token>',
});

<VibressStudio value={doc} onChange={setDoc} uploadAdapter={adapter} />
```

## Rendering public HTML safely (server-side)

```ts
import { renderStudioDocumentToHtml } from '@vibress/studio-renderer';

const html = renderStudioDocumentToHtml(post.document); // SSR-safe
```

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:security
pnpm test:a11y
pnpm test:roundtrip
pnpm test:e2e
pnpm build
pnpm audit --prod
pnpm verify:explicit-any
pnpm verify:package-exports
```

CI runs lint, explicit-any guard, typecheck, tests, build, and a production
audit on every push to `main` and on pull requests (`.github/workflows/ci.yml`).

## Security

- Renderers escape text, validate and escape URLs, and sanitize HTML with a
  strict allowlist policy (`sanitize-html`-backed). No regex-only
  sanitization.
- The HTML card sanitizes strictly; the embed card emits iframes only for a
  provider allowlist.
- React previews render only through the branded `SafeHtml` boundary.
- XSS regression payloads live in `@vibress/studio-testing` and are
  exercised by the security suite.

## Documentation

| Doc | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Layering, data flow, boundaries |
| [docs/security.md](docs/security.md) | Security model and guarantees |
| [docs/security/threat-model.md](docs/security/threat-model.md) | Trust model, attack surfaces |
| [docs/security/xss-regression-matrix.md](docs/security/xss-regression-matrix.md) | Payload × layer coverage |
| [docs/sanitization-policy.md](docs/sanitization-policy.md) | Allowlist policy, customization |
| [docs/cards.md](docs/cards.md) | Card definitions and how to add cards |
| [docs/import-export.md](docs/import-export.md) | HTML/markdown import & export |
| [docs/media-upload-adapter.md](docs/media-upload-adapter.md) | Upload adapter contract |
| [docs/plugin-sdk.md](docs/plugin-sdk.md) | Safe plugin authoring |
| [docs/package-exports.md](docs/package-exports.md) | Publishing and verification |
| [docs/testing.md](docs/testing.md) | Test suite organization incl. browser E2E |
| [docs/vibress-integration.md](docs/vibress-integration.md) | Vibress core integration guide |
| [docs/production-readiness.md](docs/production-readiness.md) | Readiness criteria and evidence |

## License

MIT — see [LICENSE](LICENSE).
