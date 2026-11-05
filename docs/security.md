# Vibress Studio — Security Model and Evidence

**Maintained against source:** 2026-11-04. This document explains controls and limitations; it is not a blanket security certification.

Related: [threat model](security/threat-model.md), [sanitization policy](sanitization-policy.md), [source reassessment](audits/studio-source-reassessment-2026-11-04.md) and [fix roadmap](roadmaps/global-ux-quality-roadmap.md#16-current-authoritative-remediation-and-development-plan--2026-11-04).

## Actual sanitizer and trust boundaries

The current HTML sanitizer is **`sanitizeStudioHtml`** in `packages/studio-utils/src/sanitize.ts`, implemented with **parse5** and a tag/attribute allowlist. `sanitizeHtml` in `packages/studio-utils/src/index.ts` calls it. There is no current `sanitizeHtmlFragment`, `HTML_SANITIZE_POLICY`, `packages/studio-utils/src/sanitize/policy.ts`, or `sanitize-html`-based implementation.

- Treat persisted documents, imported HTML/Markdown, pasted fragments, card payloads, URLs, captions and plugin renderer output as untrusted.
- The final `renderStudioDocumentToHtml` boundary validates/migrates the document, escapes output and applies `sanitizeStudioHtml`. Never bypass the boundary by injecting card HTML directly.
- Plugin authors can define untrusted renderer functions. `StudioPluginRegistry.renderCardHtml` passes registered card output through validation and sanitization; **plugins are not sandboxed**.
- The React editor's static card path uses `sanitizeStudioHtml` before `dangerouslySetInnerHTML`; do not claim an exclusive `SafeHtml` wrapper exists in this revision. The playground preview uses sanitized renderer output.
- `getEmbedProvider` supports **YouTube and Vimeo** (not arbitrary providers). Iframes must carry validated provider URLs; the HTML sanitizer enforces its own allowlist.
- URLs and attributes require context-specific checks. `blob:` URLs are rejected for persisted/published media. The sanitizer allows a restricted raster `data:image/` family; do not treat that as permission to persist raw data URLs.
- The host is responsible for authorization, secure media storage, AI gateway permissions, auditing and publication. Client-side validation does not substitute for host checks.

## Remediation status of security and integrity findings

| Reference | Priority | Remediation & Verification Status |
| --- | --- | --- |
| `STU-R05` | P1 security | **Resolved & Verified (PR #10):** Markdown link export enforces shared URL protocol validation (HTTP/HTTPS/mailto/tel) and Markdown character escaping. Tested in `packages/studio-testing/security/markdown-security.test.ts`. |
| `STU-R01` | P0 integrity | **Resolved & Verified (PR #7):** Invalid non-null persisted documents are preserved and recoverable errors surfaced; absent inputs default safely to empty document. Tested in `packages/studio-core/src/__tests__/migrate.test.ts` and `packages/studio-react/src/__tests__/document-recovery.test.tsx`. |
| `STU-R02` | P0 integrity | **Resolved & Verified (PR #9):** Asynchronous image uploads re-read latest node data on completion, preserving concurrent caption, alt, width, and metadata edits without resurrecting deleted cards. Tested in `packages/studio-react/src/__tests__/image-upload-concurrent.test.tsx`. |
| `STU-R04` | P1 fidelity/security | **Resolved & Verified (PR #13):** Text colors and highlights use strict allowlisted CSS color values (named colors, hex codes, hsl/rgb) and sanitize against arbitrary CSS injection. Tested in `packages/studio-renderer/src/__tests__/renderer.test.ts`. |
| `STU-R13` | P1 integration | **Resolved & Verified (PR #17):** Plugin cards render strictly through `StudioPluginRegistry.renderCardHtml` with mandatory `sanitizeStudioHtml` filtering. Tested in `tests/studio-plugin-registry.test.ts`. |

## Test coverage

Actual active files include `packages/studio-utils/src/__tests__/sanitize.test.ts`, `packages/studio-testing/security/content-security.test.ts`, `packages/studio-testing/security/roundtrip.test.ts`, `tests/html-import-regressions.test.ts`, and E2E specs `05-html-card-xss.spec.ts` and `06-import-export.spec.ts`.

`pnpm test:security` and the CI run cover these existing regressions. Do not claim that absent historical tests in earlier docs are current or that all attack vectors are proven impossible.

## Reporting vulnerabilities

Disclose suspected exploitable issues privately to the repository owner/security contact; avoid publishing working payloads or production-sensitive details in public issues. Record reproduction, affected revision, impact, proposed regression and mitigation through the appropriate authorized channel.
