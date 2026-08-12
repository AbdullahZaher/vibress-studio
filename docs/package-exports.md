# Vibress Studio — Package Exports & Architecture

## Layering

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
`studio-react`. This is enforced by `pnpm verify:package-exports` and
`packages/studio-testing/package-exports.test.ts`.

## Publishable packages

Every package is ESM (`"type": "module"`) and exports built output only:

```json
{
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
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
