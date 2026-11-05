# Vibress Studio — Architecture and Boundaries

**Source-reviewed:** 2026-11-04 at standalone SHA `be7150d04aa31e53034e832e16726a69f2c9c6e7`. For active findings and design remediation see [source reassessment](audits/studio-source-reassessment-2026-11-04.md) and [roadmap §16](roadmaps/global-ux-quality-roadmap.md#16-current-authoritative-remediation-and-development-plan--2026-11-04).

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

**Open integrity issue:** `migrateDocument` currently returns an empty document for some unsupported non-null inputs. It must distinguish *new document / no value* from *unrecognized existing document* and preserve the source on failure (audit STU-R01). Unknown v1 nodes, cards, styles, directions and captions require round-trip verification.

## Package ownership and dependency direction

| Package | Responsibility | Notes |
| --- | --- | --- |
| `studio-core` | Schema v1, migrations, validation | Server-safe |
| `studio-utils` | parse5 HTML sanitizer, URL/escape helpers, Markdown-to-HTML helper | Server-safe |
| `studio-card-definitions` | Serializable Zod card contracts and safe renderers | Server-safe |
| `studio-cards` | Compatibility exports and Lexical card node | Editor dependency |
| `studio-renderer` | Server HTML and plain-text output | Server-safe |
| `studio-html` | HTML import/export integration | Server-safe |
| `studio-markdown` | Markdown export/import integration | Server-safe; export has open URL-policy gap |
| `studio-serializer` | Document ↔ serialized state helpers | Server-safe |
| `studio-nodes` / `studio-transforms` | Lexical nodes and interactions | Editor |
| `studio-react` | React editor, interactive cards, upload/media/AI hooks and CSS | Editor |
| `studio-plugin-sdk` | Plugin registry, safe renderer registration | Registry, **not** sandbox; editor integration limited |
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

## Canonical runtime proposal

`docs/adr/0001-studio-canonical-runtime.md` says **Proposed**. Its intended direction uses `AbdullahZaher/vibress` as the reference for the currently shipped runtime and standalone as a downstream distribution target. The source review observed host SHA `b33fb1ab597bfabb8861516132cf8bad567f0bf1`. Host collaboration exports are missing from standalone, so **do not assume parity or copy host files blindly**. Obtain explicit ADR approval and compare named SHAs and v1 fixtures before syncing.

## Visual CSS contract and accessibility

Public CSS tokens and styles are exported by `studio-react`, but portions of interactive cards use unbundled Tailwind-like utility classes, and some global selectors leak beyond Studio. A clean consuming app without host/Tailwind CSS must be used to verify the component contract before presenting the standalone design as self-contained.

All editing and display features require RTL, LTR, mixed bidi, light/dark, narrow viewport, keyboard and touch evidence; see roadmap §16.4.
