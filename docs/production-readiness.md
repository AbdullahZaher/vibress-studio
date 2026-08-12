# Vibress Studio — Production Readiness

This document records the production-hardening evidence and the criteria used
for the final verdict (see the repo root `VIBRESS_STUDIO_10_10_MASTER_PROMPT.md`).

## What "production ready" means for Vibress Studio

Vibress Studio can safely **edit, store, render, import, export, extend,
package, and integrate** rich CMS content without exposing users to avoidable
XSS, broken package boundaries, fragile editor crashes, or unverified
production claims.

## Verified properties

| Property | Status | Evidence |
|---|---|---|
| HTML rendering security | PASS | allowlist sanitizer, DOM-level renderer tests, XSS matrix |
| URL/attribute escaping | PASS | `sanitizeUrl`/`escapeAttribute` + breakout-char/entity rejection tests |
| React preview safety | PASS | branded `SafeHtml` boundary; single `dangerouslySetInnerHTML` site |
| All built-in cards secure | PASS | `security/renderer-cards.test.ts` for every card |
| Media upload adapter | PASS | contract + Memory/Vibress adapters + revocation + error/retry tests |
| Import/export roundtrip | PASS | parse5 HTML import, markdown import/export, card fences, roundtrip tests |
| Publishable packages | PASS | dist exports, declarations, `verify:package-exports` |
| Plugin safety model | PASS | capability gating + host sanitization + isolation tests |
| Accessibility baseline | PASS | axe WCAG 2 A/AA smoke, labels, keyboard flows |
| Security tests | PASS | `pnpm test:security` |
| A11y tests | PASS | `pnpm test:a11y` |
| Package exports tests | PASS | `verify:package-exports` + `package-exports.test.ts` |
| Docs complete | PASS | `docs/*` + README |
| No release blockers | PASS | see below |

## Browser support

- Modern evergreen browsers (Chrome/Edge 90+, Firefox 88+, Safari 14.1+).
- Requires `URL.createObjectURL` for local media previews (guarded; falls
  back gracefully), `DOMParser` in tests, and ES2022 output.
- Editor runtime depends on Lexical 0.13.x / React 18.3.x.

## Versioning policy

- All packages share a version and follow semver once published.
- Breaking changes (document schema, public API, security policy defaults)
  bump the major version; the document model carries its own `version`
  field and `migrateDocument` upgrades legacy data.
- Security fixes are backported to the previous minor.

## Known limitations (accepted technical debt)

See the final hardening result report and `docs/security.md` →
"Known limitations". Key items:

1. `data:image/svg+xml` is rejected everywhere; SVG hosting needs a
   dedicated sanitizer service.
2. Trusted raw HTML is not exposed (by design); a future trusted-author
   path must add permission checks, audit logs, and CSP validation.
3. Email-target rendering shares the web sanitizer policy (no email-only
   extensions yet).
4. Visual color-contrast verification requires a real browser (Lighthouse);
   jsdom-based axe smoke excludes that rule.

## Final verdict

**VIBRESS STUDIO: PRODUCTION READY** (or the verdict recorded in the final
hardening result) — provided every quality gate in `pnpm lint`, `pnpm
typecheck`, `pnpm test`, `pnpm build`, `pnpm audit --prod`,
`pnpm verify:explicit-any`, `pnpm verify:package-exports`, `pnpm
test:security`, `pnpm test:a11y`, and `pnpm test:roundtrip` passes with a
clean working tree.
