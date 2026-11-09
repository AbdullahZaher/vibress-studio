# Vibress Studio — Architecture and Boundaries

**Source-reviewed:** 2026-11-05, with PR #28 changes under active CI verification. Historical assessment baseline: `36445d0288bed112e84944b838bea7373589d5bc`. For active findings and design remediation see [source reassessment](audits/studio-source-reassessment-2026-11-04.md) and [roadmap §16](roadmaps/global-ux-quality-roadmap.md#16-current-authoritative-remediation-and-development-plan--2026-11-04).

## Canonical document envelope

```json
{
  "schema": "vibress-studio",
  "version": 1,
  "editor": { "lexicalVersion": "0.13.1" },
  "root": { "type": "root", "children": [] }
}
```

`studio-core` provides Zod validation, migration, normalization and document factories. The document tree allows forward-compatible unknown children. Legacy `react-studio-card` nodes normalize to `studio-card`. No schema fork or implicit rewriting of user documents is permitted.

**Document migration and recovery (STU-R01 — Resolved):** `migrateDocument` distinguishes genuinely absent/null inputs (which yield an empty document) from unsupported or unrecognized non-null documents. Invalid persisted inputs are preserved without silent reset, and recoverable validation errors are surfaced to the caller. Round-trip and unknown-node preservation is verified by `packages/studio-core/src/__tests__/migrate.test.ts` and `packages/studio-react/src/__tests__/document-recovery.test.tsx`.

## Package ownership and dependency direction

| Package | Responsibility | Notes |
| --- | --- | --- |
| `studio-core` | Schema v1, migrations, validation | Server-safe |
| `studio-utils` | parse5 HTML sanitizer, URL/escape helpers, Markdown-to-HTML helper | Server-safe |
| `studio-card-definitions` | Serializable Zod card contracts and safe renderers | Server-safe |
| `studio-cards` | Compatibility exports and Lexical card node | Editor dependency |
| `studio-renderer` | Server HTML and plain-text output | Server-safe; color/formatting verified |
| `studio-html` | HTML import/export integration | Server-safe |
| `studio-markdown` | Markdown export/import integration | Server-safe; URL policy and link escaping verified (STU-R05) |
| `studio-serializer` | Document ↔ serialized state helpers | Server-safe |
| `studio-nodes` / `studio-transforms` | Lexical nodes and interactions | Editor |
| `studio-react` | React editor, interactive cards, upload/media/AI hooks and CSS | Editor; self-contained styles and direction support |
| `studio-plugin-sdk` | Plugin registry, safe renderer registration | Registry (non-sandboxed in-process); integrated via `useStudioPluginRegistry` (STU-R13) |
| `studio-testing`, `tests`, `e2e`, `playground` | Fixtures and verification harnesses | Development |

Never import React or Lexical into server-safe packages. Public imports must use package export maps; no cross-package private deep paths. The workspace package-export verification checks actual distribution contracts, but does not by itself prove every architectural claim.

## Data and trust boundaries

```text
Host-owned authenticated persistence / revision control
       │ validated current or legacy document input
       ▼
studio-core: migration + normalization + validation
       │                              ▲
       ▼                              │
studio-react: Lexical editor   onChange validated snapshot
       │
       ├── host uploadMedia/requestMedia (durable publication asset)
       ├── optional host AI callback (authorized, consent-aware)
       └── editor-local selection, history, commands and card editing
                                      │
stored document ─► studio-renderer ─► final sanitizeStudioHtml ─► public HTML
                └► studio-markdown (separate URL/escaping boundary)
```

`studio-utils/src/sanitize.ts` uses **parse5**, not `sanitize-html`; `sanitizeHtmlFragment`, `HTML_SANITIZE_POLICY` and a `SafeHtml`-only branded boundary are not present in the current tree. The static React card path invokes the sanitizer before HTML injection. Plugin HTML must be rendered through the registry's safe rendering method.

Current embed allowlist supports YouTube and Vimeo. Treat all document, caption, URL, imported and plugin content as untrusted.

## Editor and host ownership

- **Studio:** Lexical state, selection, undo/redo, card editing, `onChange` snapshots, server-safe renderers, media/AI *callbacks*.
- **Host:** auth, autosave, publication context, revision conflicts, durable asset storage, collaboration provider lifecycle and AI gateway.
- **Do not** add a Studio backend, persistence store or Yjs service for parity. Scope such integrations in the host and test via public APIs.

### External synchronization and revision management
`studio-react` implements an explicit synchronization contract via `DocumentSyncPlugin`:
- Distinguishes local `onChange` echoes from out-of-order autosave responses and genuine external updates.
- Treats `revisionId` as informational host metadata. A new `replacementId` explicitly authorizes a deliberate restore or document switch after host-side conflict resolution.
- Rejects stale echoes to guarantee newer local keystrokes are never overwritten by delayed autosave acknowledgments.
- Preserves selection, caret position, and undo/redo stacks when content is unchanged.
- Guarantees deterministic heading slug allocation between `studio-renderer` and `extractTableOfContentsFromDocument` via `HeadingSlugTracker`.

## Approved runtime ownership (ADR-0001 Option B)

[`ADR-0001`](adr/0001-studio-canonical-runtime.md) records **Approved — Option B** as of 2026-11-08: `AbdullahZaher/vibress` remains the reference for currently shipped host runtime behavior, and standalone Studio is a downstream compatibility/distribution target. The evaluated immutable host SHA is `3344f83f30dd23205abb596f4320857f4611812a` (CMS beta.1), compared with Studio release candidate `f13bdf1e049434c71da74572f4e226457fdb6393` (Studio beta.2). The nine persisted core fixtures are checked in CI; the standalone editor **does not** thereby acquire the host's Yjs provider, autosave, or collaboration contracts. Do not substitute runtimes or copy code blindly. See [G0–G5 release evidence correction](audits/release-evidence-correction-2026-11-09.md).

## Visual CSS contract and accessibility

Public CSS tokens and scoped styles are exported by `studio-react`; the
standalone branch includes explicit fallbacks for legacy Tailwind-like utility
classes and direction-aware layouts. The host must verify these against its
actual theme and bundler, including light/dark and editor/public rendering.
Chromium CI provides automated checks, not a manual Safari/Firefox,
screen-reader or full host-release certification.


## Synchronization contract under PR #28 review (2026-11-05)

An autosave acknowledgment is not an external replacement command. Changes to
`revisionId` are metadata; deliberate revision restorations or authoritative
remote replacements require a unique `replacementId` after host-side conflict
resolution. Studio protects locally edited content from ambiguous incoming
`value` changes regardless of history length. See
[vibress integration](vibress-integration.md#external-value-synchronization-and-explicit-document-replacement).
Do not claim host autosave or Yjs parity until tested against a named host SHA
(`b33fb1ab597bfabb8861516132cf8bad567f0bf1`).
