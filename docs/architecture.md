# Vibress Studio Architecture

## Document model

A studio document is a versioned JSON tree with a fixed envelope:

```json
{
  "schema": "vibress-studio",
  "version": 1,
  "editor": { "lexicalVersion": "0.13.1" },
  "root": { "type": "root", "children": [...] }
}
```

`@vibress/studio-core` owns the envelope: `StudioDocumentSchema` (Zod),
`validateStudioDocument`, `migrateDocument` (upgrades legacy/unknown input to
the current version), and `createEmptyStudioDocument` /
`createDefaultStudioDocument` factories. Node `children` are stored as
`unknown[]`; renderers narrow each child to a structural shape before walking
it, so the stored model stays open for forward-compatible extensions.

## Package layering

```
studio-core          schema, document model, validation, migration, upload contracts
studio-cards         serializable card definitions + Zod schemas + safe renderers
studio-renderer      safe server HTML / plain-text rendering
studio-html          sanitizer layer, HTML import (parse5)
studio-markdown      markdown import/export
studio-nodes         Lexical node set (incl. StudioCardNode) — editor-side only
studio-transforms    Lexical node transforms — editor-side only
studio-react         React editor, card editors, SafeHtml boundary, upload adapters
studio-plugin-sdk    plugin/card registration boundary with capability model
studio-testing       fixtures and security/a11y/perf test suites
studio-serializer    document serialization helpers
studio-utils         shared utilities (sanitizer implementation, URL safety)
```

**Boundary rule:** server renderer packages (`studio-core`, `studio-cards`,
`studio-utils`, `studio-html`, `studio-markdown`, `studio-renderer`,
`studio-serializer`, `studio-plugin-sdk`) never import React or Lexical.
Lexical lives only in `studio-nodes`, `studio-transforms`, and
`studio-react`. Enforced by `pnpm verify:package-exports`.

## Boundaries

- **Editing** lives in `@vibress/studio-react` (Lexical). It is the only
  package with a browser dependency.
- **Rendering** lives in `@vibress/studio-renderer` (+ `studio-html`,
  `studio-markdown`) and is deliberately server-safe: no `document`/`window`
  access, all output escaped/sanitized.
- **Cards** (`@vibress/studio-cards`) define per-type Zod schemas, HTML and
  plain-text renderers. Every renderer is safe by default (see
  `docs/cards.md`). The Lexical `StudioCardNode` lives in `studio-nodes`, so
  card definitions carry no Lexical dependency.
- **Plugins** register through `@vibress/studio-plugin-sdk` and never reach
  into `studio-react` internals.

## Data flow

```
Editor (studio-react)
  └─ exportJSON / importJSON ─▶ studio document (unknown) ─▶ migrateDocument
        ─▶ validateStudioDocument
  Renderers (studio-renderer / studio-markdown) walk the narrowed node shape
  Cards validate their `cardData` with per-type Zod schemas before rendering.
  Public HTML: renderStudioDocumentToHtml (server-safe)
  Import: htmlToStudioDocument (parse5) / markdownToStudioDocument
  Export: studioDocumentToMarkdown
```

## Security

- `escapeHtml`, `escapeAttribute`, `sanitizeUrl`, `isSafeUrl` and the
  allowlist `sanitizeHtmlFragment` (backed by `sanitize-html`) in
  `@vibress/studio-utils` are the only gatekeepers for string/HTML/URL
  output. The regex sanitizer was removed (P1).
- The HTML card sanitizes strictly (Option B); the embed card uses a
  provider allowlist.
- React previews render through the branded `SafeHtml` boundary only (P3).
- XSS regression payloads (`@vibress/studio-testing`) assert renderers never
  emit executable content (see `docs/security/xss-regression-matrix.md`).

## Type safety

The workspace enforces a zero-explicit-`any` policy for production source via
`scripts/count-explicit-any.mjs` (`pnpm verify:explicit-any`). The few places
where Lexical's serialized-state APIs need bridging use
`as unknown as Parameters<...>[0]` casts instead of `any`.
