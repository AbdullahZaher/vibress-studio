# Vibress Studio

Standalone reusable rich-content editor for Vibress — a document
model, Lexical-based editing experience, and server-safe renderers
(HTML / plain text / Markdown) that share one validated schema.

The repository includes a parse5-backed HTML allowlist sanitizer, card renderers, import/export tooling, host media/AI hooks, and automated tests. **The current source audit identifies open integrity, fidelity, CSS integration and accessibility verification work; production readiness is not certified.** See the [2026-11-04 source reassessment](docs/audits/studio-source-reassessment-2026-11-04.md), [remediation roadmap](docs/roadmaps/global-ux-quality-roadmap.md#16-current-authoritative-remediation-and-development-plan--2026-11-04) and [readiness gates](docs/production-readiness.md).

## Packages

| Package | Purpose |
|---|---|
| `@vibress/studio-core` | Canonical `vibress-studio` document schema, validation and migration |
| `@vibress/studio-cards` | Compatibility card exports and Lexical card node; serializable card contracts/renderers are in `studio-card-definitions` |
| `@vibress/studio-card-definitions` | Portable Zod card contracts and safe HTML/plain-text renderers |\n| `@vibress/studio-renderer` | Server-safe renderers: `renderStudioDocumentToHtml` / `renderStudioDocumentToPlainText` |
| `@vibress/studio-html` | HTML import (`htmlToStudioDocument`, parse5) |
| `@vibress/studio-markdown` | Markdown import/export (`markdownToStudioDocument` / `studioDocumentToMarkdown`) |
| `@vibress/studio-nodes` | Lexical node set (paragraph, heading, quote, list, link, code, StudioCardNode) — editor-side |
| `@vibress/studio-transforms` | Lexical node transforms — editor-side |
| `@vibress/studio-plugin-sdk` | Plugin/card registry with validation and sanitized HTML rendering; not a sandbox or fully integrated editor plugin host |
| `@vibress/studio-react` | React/Lexical editor and card editing UI, media/AI host callbacks |
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

// Implement uploadMediaToCurrentPublication in your authenticated host.
// It must return a durable { assetId, src } object or null.
<VibressStudio
  value={doc}
  onChange={setDoc}
  uploadMedia={uploadMediaToCurrentPublication}
/>
```

## Optional AI completion provider

AI is **disabled by default**. The standalone editor never fabricates AI
completions. To expose the inline AI action, a host must explicitly enable it
**and** supply an authenticated, permission-checked provider callback:

```tsx
<VibressStudio
  value={doc}
  onChange={setDoc}
  enableAi={aiGatewayReady}
  onAiGenerate={async (prompt) => {
    // Call your host's authorized AI Gateway API, not a browser-side secret.
    return aiGateway.generate(prompt);
  }}
/>
```

The configured UI can be invoked with Space on an empty paragraph. The host
remains responsible for provider availability, publication/user permissions,
rate limits, timeouts, abuse controls, content filtering and cost accounting.
The optional second argument of onAiGenerate includes the current full Studio
document. Do not send this document to a third party without explicit user
consent and the host's publication-scoped authorization checks.
Provider errors are shown rather than substituted with fake text. Discarding
or closing the panel ignores late provider results; it does not guarantee
cancellation of the underlying request. Do not expose provider API keys
directly in the browser.

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

- Renderers escape text, validate URLs and sanitize HTML with a
  parse5-backed allowlist policy (`sanitizeStudioHtml`). No regex-only
  sanitization.
- The HTML card sanitizes strictly; the embed card emits iframes only for a
  provider allowlist.
- React static cards sanitize HTML before injection; the playground preview uses the sanitized document renderer.
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
| [docs/audits/studio-source-reassessment-2026-11-04.md](docs/audits/studio-source-reassessment-2026-11-04.md) | Source-evidenced findings and verification limits |\n| [docs/production-readiness.md](docs/production-readiness.md) | Readiness criteria and evidence |

## UX and Design Quality Roadmap

- [Global-quality UX & Design Execution Roadmap](docs/roadmaps/global-ux-quality-roadmap.md) — phased remediation and future development plan; §16 supersedes historical unverified readiness/quality-score claims.

## License

MIT — see [LICENSE](LICENSE).
