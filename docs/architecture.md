# Vibress Studio Architecture

## Document model

A studio document is a versioned JSON tree with a fixed envelope:

```json
{
  "schema": "vibress-studio",
  "version": 1,
  "root": { "type": "root", "children": [...] }
}
```

`@vibress/studio-core` owns the envelope: `StudioDocumentSchema` (Zod),
`validateStudioDocument`, `migrateDocument` (upgrades legacy/unknown input to
the current version), and `createEmptyStudioDocument` /
`createDefaultStudioDocument` factories. Node `children` are stored as
`unknown[]`; renderers narrow each child to a structural shape before walking
it, so the stored model stays open for forward-compatible extensions.

## Boundaries

- **Editing** lives in `@vibress/studio-react` (Lexical). It is the only
  package with a browser dependency.
- **Rendering** lives in `@vibress/studio-renderer` (+ `studio-html`,
  `studio-markdown`) and is deliberately server-safe: no `document`/`window`
  access, all output escaped/sanitized.
- **Cards** (`@vibress/studio-cards`) define per-type Zod schemas, HTML and
  plain-text renderers, and editor metadata. Editors receive their own
  validated `cardData` type; the React registry widens the prop contract to
  `unknown` at the lookup boundary (single documented cast, no `any`).
- **Plugins** register through `@vibress/studio-plugin-sdk` and never reach
  into `studio-react` internals.

## Data flow

```
Editor (studio-react)
  └─ exportJSON / importJSON ─▶ studio document (unknown) ─▶ migrateDocument
        ─▶ validateStudioDocument
  Renderers (studio-renderer / studio-markdown) walk the narrowed node shape
  Cards validate their `cardData` with per-type Zod schemas before rendering.
```

## Security

- `escapeHtml`, `sanitizeHtml`, `isSafeUrl`, `sanitizeUrl` in
  `@vibress/studio-utils` are the only gatekeepers for string/URL output.
- `studio-html` runs HTML through sanitization on import.
- XSS test payloads (`@vibress/studio-testing`) assert renderers never emit
  executable content.

## Type safety

The workspace enforces a zero-explicit-`any` policy for production source via
`scripts/count-explicit-any.mjs` (`pnpm verify:explicit-any`). The few places
where Lexical's serialized-state APIs need bridging use
`as unknown as Parameters<...>[0]` casts instead of `any`.
