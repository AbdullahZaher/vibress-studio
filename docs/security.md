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

## Open source-evidenced concerns

| Reference | Priority | Investigation or remediation |
| --- | --- | --- |
| `STU-R05` | P1 security | Markdown exporter emits link destinations without shared URL policy / Markdown escaping. Add malicious and escaped-destination regressions before stating comprehensive Markdown boundary safety. |
| `STU-R01` | P0 candidate integrity | Unknown non-null document can migrate to an empty document. Preserve invalid input and prevent overwrite. |
| `STU-R02` | P0 candidate integrity | Async image upload applies stale captured card metadata. Test and protect concurrent edits. |
| `STU-R04` | P1 fidelity/security | Published color/highlight must use a safe allowlisted representation, never arbitrary CSS passthrough. |
| Host/plugin integration | P1 | Verify all registered renderers are rendered only through the safe public boundary. |

These are source review findings; no exploit was reproduced in the documentation update. For specific proof requirements see the [audit](audits/studio-source-reassessment-2026-11-04.md).

## Test coverage

Actual active files include `packages/studio-utils/src/__tests__/sanitize.test.ts`, `packages/studio-testing/security/content-security.test.ts`, `packages/studio-testing/security/roundtrip.test.ts`, `tests/html-import-regressions.test.ts`, and E2E specs `05-html-card-xss.spec.ts` and `06-import-export.spec.ts`.

`pnpm test:security` and the CI run cover these existing regressions. Do not claim that absent historical tests in earlier docs are current or that all attack vectors are proven impossible.

## Reporting vulnerabilities

Disclose suspected exploitable issues privately to the repository owner/security contact; avoid publishing working payloads or production-sensitive details in public issues. Record reproduction, affected revision, impact, proposed regression and mitigation through the appropriate authorized channel.
