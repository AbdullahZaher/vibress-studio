# Vibress Studio — Testing

How the suite is organized and how to run it.

## Commands

```bash
pnpm test                # full suite (vitest, jsdom)
pnpm test:security       # security/XSS regression suites
pnpm test:a11y           # axe accessibility smoke tests
pnpm test:roundtrip      # import/export roundtrip tests
pnpm verify:package-exports
pnpm verify:explicit-any
pnpm lint
pnpm typecheck
pnpm build
pnpm audit --prod
```

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
