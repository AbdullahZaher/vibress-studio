# Vibress Studio — Testing

How the suite is organized and how to run it.

## Commands

```bash
pnpm test                # full suite (vitest, jsdom)
pnpm test:security       # security/XSS regression suites
pnpm test:a11y           # axe accessibility smoke tests
pnpm test:roundtrip      # import/export roundtrip tests
pnpm test:e2e            # browser E2E (Playwright + Chromium + Lighthouse)
pnpm test:e2e:lighthouse # Lighthouse-only E2E run
pnpm test:e2e:install    # install the Playwright Chromium browser
pnpm verify:package-exports
pnpm verify:explicit-any
pnpm lint
pnpm typecheck
pnpm build
pnpm audit --prod
```

## Browser E2E (Playwright)

The `e2e/` directory contains a Playwright harness that runs against the
playground's dedicated test page (`playground/e2e.html`, built by
`E2EHarness.tsx`). The harness mounts the editor with a mock upload adapter
and import/export controls, and exposes `window.__studio` for assertions.

| Spec | Covers |
|---|---|
| `01-editor-editing.spec.ts` | editor loads, typing paragraphs, bold, heading/list conversion via UI |
| `02-slash-menu-cards.spec.ts` | slash menu inserts every built-in card; placeholders render |
| `03-card-edit-remove-retry.spec.ts` | bookmark URL validation, html/button card edits, keyboard removal |
| `04-upload-adapter.spec.ts` | mock upload success, error overlay, retry, dismiss, video upload |
| `05-html-card-xss.spec.ts` | XSS payloads typed into the HTML card never execute in preview |
| `06-import-export.spec.ts` | HTML/markdown import + export through the UI, malicious input sanitized |
| `07-keyboard-nav.spec.ts` | slash menu arrow/escape navigation, tab order, focus retention |
| `08-lighthouse.spec.ts` | Lighthouse accessibility with real-browser color-contrast |

### What the E2E suite caught

The browser harness found and verified fixes for several real editor bugs
that jsdom tests could not:

1. `ReactStudioCardNode` lacked `exportJSON`/`importJSON` (serialization
   errors on every card insert).
2. `DecoratorNode.isInline()` defaults to `true` — cards were inserted
   *inside* paragraphs instead of as top-level blocks. Cards now override
   `isInline()` to `false`.
3. Clicking a card (a `contenteditable="false"` region) made Lexical null the
   node selection — keyboard deletion of cards was broken. Card selection is
   now re-asserted (`assertCardSelection`) so Delete/Backspace works.
4. The editor contenteditable used `aria-label` instead of Lexical's
   `ariaLabel` prop — the accessible name was missing.
5. A form `type="url" required` input blocks submission for non-URL values
   via native browser validation before the app's validation runs (the
   placeholder now documents this; tests use a URL-shaped unsafe value).
6. `verify:package-exports` now also verifies dist is Node-ESM-runnable
   (explicit `.js` extensions).

## Suites

| Location | Covers |
|---|---|
| `packages/studio-testing/security/xss-payloads.test.ts` | canonical XSS payloads × escape/URL layers |
| `packages/studio-testing/security/sanitize.test.ts` | allowlist policy, all 10 matrix payloads, entity obfuscation |
| `packages/studio-testing/security/renderer-cards.test.ts` | every built-in card renderer safe by default, DOM-level assertions |
| `packages/studio-testing/security/safe-html.test.tsx` | React `SafeHtml` boundary, branded type, embed iframe gating |
| `packages/studio-testing/security/editor-robustness.test.tsx` | slash menu regex safety, bookmark malformed URLs, card error boundary |
| `packages/studio-testing/security/media-upload.test.tsx` | adapter contract, validation, progress/error/retry, object URL revocation |
| `packages/studio-testing/security/roundtrip.test.ts` | HTML/markdown import-export roundtrips + malicious input |
| `packages/studio-testing/security/plugin-safety.test.ts` | plugin capability model, host sanitization |
| `packages/studio-testing/a11y/accessibility.test.tsx` | axe WCAG 2 A/AA smoke (color-contrast excluded under jsdom), labels, keyboard |
| `packages/studio-testing/package-exports.test.ts` | dist exports, no server React/Lexical |
| `packages/studio-testing/suites/migration-recovery.test.ts` | migration compatibility, malformed document recovery, serializer |
| `packages/studio-testing/suites/performance.test.ts` | large-document benchmark-style tests (report timings, generous ceilings) |

## Security testing approach

- **Payloads** come from `docs/security/xss-regression-matrix.md`.
- **DOM-level assertions**: renderer output is parsed with `DOMParser` and
  checked for live dangerous elements/attributes — escaped text content is
  not falsely flagged.
- **Idempotence**: rendered output must be stable under re-sanitization.
- **Escape-layer vs sanitizer-layer**: tests distinguish what escaping
  guarantees (text) from what the sanitizer guarantees (HTML fragments).

## Accessibility testing

`axe-core` runs against rendered components (WCAG 2 A/AA). `color-contrast`
is disabled because it requires a real browser paint engine; run the
playground + Lighthouse in a browser for visual contrast verification.

## Performance testing

Benchmark-style tests in `suites/performance.test.ts`:

- render 1,000 paragraphs
- render 500 cards
- import large HTML (800 paragraphs)
- export large markdown (500 paragraphs)
- import large markdown (300 paragraphs)
- plain-text render 1,000 paragraphs

Each prints its timing (`[perf] ...`) and asserts a generous ceiling so
regressions fail CI without flaking on slow machines.

## CI

`.github/workflows/ci.yml` runs lint, explicit-any guard, typecheck, tests,
build, and `pnpm audit --prod`.
