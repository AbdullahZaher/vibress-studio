# Vibress Studio — Package Exports & Architecture

## Layering

```
studio-core          schema, document model, validation, migration, upload contracts
studio-card-definitions  server-safe card schemas and rendering definitions
studio-cards         compatibility exports and Lexical card node
studio-renderer      safe server HTML / plain-text rendering
studio-html          sanitizer layer, HTML import (parse5)
studio-markdown      markdown import/export
studio-nodes         Lexical node set — editor-side only
studio-transforms    Lexical node transforms — editor-side only
studio-react         React editor, card editors, SafeHtml boundary, upload adapters
studio-plugin-sdk    plugin/card registration boundary with capability model
studio-testing       fixtures and security/a11y/perf test suites
studio-serializer    document serialization helpers
studio-utils         shared utilities (sanitizer implementation, URL safety)
```

**Boundary rule:** server renderer packages (`studio-core`, `studio-card-definitions`,
`studio-utils`, `studio-html`, `studio-markdown`, `studio-renderer`,
`studio-serializer`, `studio-plugin-sdk`) never import React or Lexical.
Lexical lives only in `studio-nodes`, `studio-transforms`, and
`studio-react`. This is enforced by `pnpm verify:package-exports` and
`packages/studio-testing/package-exports.test.ts`.

## Publishable packages

Every package publishes dual-module output: ESM for browsers and Node import; CommonJS for existing require consumers:

```json
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "files": ["dist"]
}
```

No package points `main`/`types` at `src`. `pnpm build` emits `dist/` with
`.d.ts` declarations.

## Verification

```bash
pnpm build                   # emit dist for every package
pnpm verify:package-exports  # exports → dist, declarations exist, no server React/Lexical
```

The verifier checks, per package:

1. `main` / `types` / `exports["."]` point to `dist`.
2. No `src/` references in publishable entry points.
3. `dist/index.js` and `dist/index.d.ts` exist after build.
4. `files` includes `dist`.
5. Server packages' source AND dist contain no React/Lexical imports.

## Versioning

All packages share version `0.1.0` and follow semantic versioning once
published: breaking changes (schema, public API, security policy defaults)
bump major; features bump minor; fixes bump patch. The document schema has
its own version (`StudioDocument.version`) with `migrateDocument` handling
legacy formats (strings, Batch 2 objects, root-only objects).

**Compatibility:** `@vibress/studio-cards` retains its public Lexical node and
re-exports all card schemas. Server code imports definitions through
`@vibress/studio-card-definitions`, avoiding Lexical at runtime. CJS output
remains supported alongside the ESM build; a future removal requires a versioned contract.

`pnpm build` emits both `dist/index.js`/`.d.ts` (NodeNext/CommonJS) and
`dist/index.mjs` (bundled ESM). The latter is required for Vite/Rollup named
exports; it must not point to a CommonJS `.js` artifact.

## Plugin card rendering boundary

`StudioCardDefinition.renderHtml()` is a **raw producer**, not a trusted HTML
sink. The platform renderer sanitizes its output. Plugin SDK consumers must use
`StudioPluginRegistry.renderCardHtml(type, data)` or
`renderStudioCardSafeHtml(definition, data)` from
`@vibress/studio-card-definitions`, which validate and sanitize before display.
Do not insert `renderHtml()` directly into the DOM.
