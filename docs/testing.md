# Vibress Studio — Test Inventory and Evidence

**Source-reviewed:** 2026-11-04. Run all tests against the exact commit you intend to release. See [AGENT.md §15](../AGENT.md#15-verification-and-definition-of-done) and [roadmap §16](roadmaps/global-ux-quality-roadmap.md#16-current-authoritative-remediation-and-development-plan--2026-11-04).

## Supported commands from root package.json

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm verify:explicit-any
pnpm typecheck
pnpm test
pnpm verify:package-exports
pnpm test:security
pnpm test:a11y
pnpm test:roundtrip
pnpm test:e2e
pnpm audit --prod
```

Packages resolve via `dist`, so build before typecheck/test on a clean checkout. CI uses `pnpm audit --prod --audit-level high`; local `pnpm audit --prod` is a distinct, stricter requested check. The explicit-any script currently uses a tolerance of `--max 50`, so a green result must not be called “zero explicit any”.

## Browser E2E suite (actual paths)

The Playwright harness is in `playground/e2e.html` with `E2EHarness.tsx` and `e2e/specs/`.

| File | Existing focus |
| --- | --- |
| `01-editor-editing.spec.ts` | Typing and basic formatting |
| `02-slash-menu-cards.spec.ts` | Slash insertion and cards |
| `03-card-edit-remove-retry.spec.ts` | Bookmark/HTML/button edits and keyboard removal |
| `04-upload-adapter.spec.ts` | Mock media adapters, retry and async cases |
| `05-html-card-xss.spec.ts` | HTML card malicious-content boundaries |
| `06-import-export.spec.ts` | HTML/Markdown import/export, tables and RTL |
| `07-keyboard-nav.spec.ts` | Slash menu focus and keyboard paths |
| `08-lighthouse.spec.ts` | Browser Lighthouse accessibility smoke |

## Unit / targeted paths present

- `packages/studio-core/src/__tests__/normalize.test.ts`
- `packages/studio-react/src/__tests__/{clone-node,color-persistence,link-normalization,slash-menu-filter,word-count}.test.ts`
- `packages/studio-renderer/src/__tests__/renderer.test.ts`
- `packages/studio-utils/src/__tests__/sanitize.test.ts`
- `packages/studio-testing/security/{content-security,roundtrip}.test.ts`
- `packages/studio-testing/a11y/semantics.test.ts`
- `tests/{studio,html-import-regressions,studio-plugin-registry}.test.ts`

Prior documentation named numerous absent tests (e.g. `packages/studio-testing/security/renderer-cards.test.ts` and `suites/performance.test.ts`). Those paths are **not** present in this reviewed tree and are not evidence.

## Latest CI evidence for the reviewed source

[2026-11-04 run 41889641281](https://github.com/AbdullahZaher/vibress-studio/actions/runs/41889641281) at `be7150d04aa31e53034e832e16726a69f2c9c6e7`: both `build` and `e2e` jobs succeeded. This confirms those command executions only; it is **not** manual UX or production certification.

## Required new regression matrix

Add explicit tests for: unsupported non-null input vs new-document default; unknown/legacy node migration; image upload with edits and removal while pending; caption first keystroke/IME/focus/undo; text color in published output; unsafe and escaped Markdown destinations; Tailwind-free consumer visual rendering; preview toggle history; picker action truthfulness; nested read-only captions; RTL/bidi/soft-keyboard navigation; plugin registry vs editor integration; and host persistence/concurrent versions. See [audited findings](audits/studio-source-reassessment-2026-11-04.md).

Use controlled promises for async cases and deterministic fixtures. Capture before/after results, command output, exact SHA, and screenshots/interaction traces for visual work. When not tested, say: `Not verified: [item]. How to verify: [command]`.
