# Vibress Studio — Test Inventory and Evidence

**Source-reviewed:** 2026-11-04. Run all tests against the exact commit you intend to release. See [AGENT.md §15](https://github.com/AbdullahZaher/vibress-studio/blob/main/AGENT.md#15-verification-and-definition-of-done) and [roadmap §16](roadmaps/global-ux-quality-roadmap.md#16-current-authoritative-remediation-and-development-plan--2026-11-04).

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
| `11-document-recovery.spec.ts` | Invalid host input pauses editing while retaining the active draft |

## Referenced unit / targeted paths (partial inventory)

- `packages/studio-core/src/__tests__/migrate.test.ts`
- `packages/studio-core/src/__tests__/normalize.test.ts`
- `packages/studio-react/src/__tests__/clone-node.test.ts`
- `packages/studio-react/src/__tests__/color-persistence.test.ts`
- `packages/studio-react/src/__tests__/document-recovery.test.tsx`
- `packages/studio-react/src/__tests__/external-recovery-draft.test.tsx`
- `packages/studio-react/src/__tests__/image-upload-concurrent.test.tsx`
- `packages/studio-react/src/__tests__/link-normalization.test.ts`
- `packages/studio-react/src/__tests__/slash-menu-filter.test.ts`
- `packages/studio-react/src/__tests__/word-count.test.ts`
- `packages/studio-renderer/src/__tests__/renderer.test.ts`
- `packages/studio-testing/a11y/semantics.test.ts`
- `packages/studio-testing/security/content-security.test.ts`
- `packages/studio-testing/security/markdown-security.test.ts`
- `packages/studio-testing/security/roundtrip.test.ts`
- `packages/studio-utils/src/__tests__/sanitize.test.ts`
- `tests/html-import-regressions.test.ts`
- `tests/studio-plugin-registry.test.ts`
- `tests/studio.test.ts`

Prior documentation named historical or proposed tests (e.g. `packages/studio-testing/security/renderer-cards.test.ts`). The list above is a partial inventory, not the full suite count. Run `pnpm test` for the current inventory; the [2026-11-05 recovery checkpoint](audits/studio-draft-recovery-2026-11-05.md) records the latest local results and their source baseline.

## Automated documentation drift verification

Documentation accuracy is enforced by `tests/docs-drift.test.ts` which automatically validates that:
- Every test file referenced in `docs/testing.md` exists on disk.
- Every workspace package in `docs/architecture.md` exists in `packages/`.
- Deprecated or removed functions (`sanitizeHtmlFragment`, `HTML_SANITIZE_POLICY`) are not present in active code or docs.

## Remediation regression matrix status

All planned regression test suites from the remediation roadmap have been implemented and verified:
- **STU-R01 (Safe migration & recovery):** `packages/studio-core/src/__tests__/migrate.test.ts`, `packages/studio-react/src/__tests__/document-recovery.test.tsx`
- **STU-R02 (Concurrent media uploads):** `packages/studio-react/src/__tests__/image-upload-concurrent.test.tsx`, `e2e/specs/04-upload-adapter.spec.ts`
- **STU-R03/R11 (Caption stability & recovery):** `e2e/specs/04-upload-adapter.spec.ts`
- **STU-R04 (Color & formatting fidelity):** `packages/studio-react/src/__tests__/color-persistence.test.ts`, `packages/studio-renderer/src/__tests__/renderer.test.ts`
- **STU-R05 (Secure Markdown export):** `packages/studio-testing/security/markdown-security.test.ts`
- **STU-R06/R10 (Scoped CSS & design system):** `e2e/specs/08-lighthouse.spec.ts`
- **STU-R07/R08/R09/R17 (Functional editor controls):** `e2e/specs/01-editor-editing.spec.ts`, `e2e/specs/03-card-edit-remove-retry.spec.ts`
- **STU-R12 (Markdown Loss Matrix & GFM fallbacks):** `docs/import-export-matrix.md`, `tests/studio.test.ts`
- **STU-R13 (Plugin SDK boundaries & registry):** `tests/studio-plugin-registry.test.ts`, `docs/plugin-sdk.md`
- **STU-R14 (Arabic RTL & mobile viewports):** `packages/studio-react/src/__tests__/slash-menu-filter.test.ts`
- **STU-R15 (Documentation alignment & drift):** `tests/docs-drift.test.ts`
- **STU-R16 (WordCountPlugin performance & efficiency):** `packages/studio-react/src/__tests__/word-count.test.ts`

Use controlled promises for async cases and deterministic fixtures. Capture before/after results, command output, exact SHA, and screenshots/interaction traces for visual work. When not tested, say: `Not verified: [item]. How to verify: [command]`.
