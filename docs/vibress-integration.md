# Vibress Studio — Host Integration Contract

**Source reviewed:** program branch `codex/studio-production-readiness-program`, starting at `619f23281a748969735dae062a25457ca0b3e519`, and immutable host core at `f56ae8b94d4f1ce45bec380580b9d238ddf8b5c1` (2026-11-05). Read [ADR-0001](adr/0001-studio-canonical-runtime.md) and [architecture](architecture.md) before integrating with the separately maintained Vibress CMS.

Studio is a **reusable editor library**, not the CMS. The host owns identity, publication permissions, persistence, autosave, version-conflict handling, durable media, AI authorization and collaboration lifecycle.

## Installing from source

The standalone workspace packages currently declare `"private": true` and version `0.1.0`. **They are not documented as published npm packages.** Work within a checked-out workspace or an explicitly tested internal package distribution:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm verify:package-exports
```

Public imports use `@vibress/studio-*` package export maps. React 18.3 and React DOM 18.3 are pinned in the standalone workspace. Its current verified Lexical contract is 0.14.3; the host has a distinct mixed-version graph that needs independent compatibility verification. Do not copy another repository's editor files or deep-import package internals to simulate host parity.

## Embedding in an authorized host

```tsx
import { VibressStudio, type VibressStudioProps } from '@vibress/studio-react';
import type { StudioDocument } from '@vibress/studio-core';

interface AdminEditorProps {
  initial: unknown;
  onDraftChange: (document: StudioDocument) => void;
  uploadMedia: NonNullable<VibressStudioProps['uploadMedia']>;
  onLoadError: (error: Error) => void;
}

export function AdminEditor({
  initial,
  onDraftChange,
  uploadMedia,
  onLoadError,
}: AdminEditorProps) {
  return (
    <VibressStudio
      value={initial}
      onChange={onDraftChange}
      onError={onLoadError}
      uploadMedia={uploadMedia}
      placeholder="Write content…"
    />
  );
}
```

**Important:** `onChange` emits editor snapshots; it is **not** a verified durable save. The host must debounce/queue saves, enforce permission checks, maintain expected revision numbers, handle version conflicts, and show truthful persistence status. An echo of an older autosave response must not overwrite newer unsaved edits. Do not remount the editor on every save. Exercise the host's actual save/reload workflow and crash recovery before release.

### External value synchronization and explicit document replacement

The editor owns the live Lexical draft. The host owns revisions, autosave ordering,
conflict resolution, persistence and authorization. The `value` prop alone cannot
distinguish a delayed autosave response from an intentional document restore.

1. **Local drafts:** `onChange` emits snapshots, not durable saves. Once the author
   changes content, a different incoming `value` is **not automatically installed**:
   it could be a stale echo. This holds even after thousands of edits, without a
   size-limited snapshot cache. Identical echoes are no-ops that preserve selection/undo.
2. **Persistence revision:** `revisionId` is optional host metadata; incrementing it
   on any successful autosave **does not** authorize replacing a live draft. The
   optional `document.revisionId` metadata behaves the same way.
3. **Explicit replacement:** Change `replacementId` only after a deliberate host
   action such as switching documents, restoring a revision, or applying an authorized
   remote update after resolving local changes:
   `<VibressStudio value={restoredDocument} replacementId={restoreOperationId} />`.
   Use a new unique token per operation. This may replace unsaved local content;
   obtain author confirmation or resolve conflicts in the host first.
4. **Initial/external loading:** Before any local edit, a genuinely new incoming
   `value` can load normally. After local edits, a host-controlled external change
   needs a new `replacementId`. Normal rerenders and save acknowledgments must
   not change that token.
5. **Host integration:** Retain the original saved document on load/migration errors,
   keep local drafts separate from server acknowledgments, and use durable
   `expectedVersion`/revision-conflict checks. Neither token implements server-side
   versioning or collaboration. Test A → B with delayed A, arbitrary out-of-order
   acknowledgments, and explicit restoration of A before shipping.
6. **Recovery during an active session:** An invalid, unsupported, or over-limit
   incoming `value` pauses editing without unmounting the existing editor. The
   live draft, selection and undo history stay in that editor. `onChange` is
   suppressed during recovery, including pending asynchronous card updates;
   `onError` receives the rejected original input through `StudioMigrationError`.
   A rejected input does not consume its `replacementId`. Supplying valid input
   resumes the same editor under the usual stale-echo rules; an explicit valid
   replacement may still replace the draft. An initially invalid document opens
   the recovery screen without creating an editor. The host must retain both
   the rejected source and any recoverable local draft, and manage in-flight
   saves: editor recovery does not cancel requests or confirm durable storage.

### Ordered envelope metadata

Root equality is not full-document equality. To change publication metadata or
unknown envelope/editor fields without resetting author content, pass the additive
`metadataRevision` prop alongside the complete validated `value` envelope:

```tsx
<VibressStudio value={authoritativeSnapshot} metadataRevision={metadataSequence}
  replacementId={documentSessionId} onChange={handleLocalDraft} />
```

The host assigns a **non-negative safe integer**, strictly increasing for each
authoritative metadata snapshot within one `replacementId` epoch. Attach the
sequence assigned to that snapshot at its source; never assign a fresh sequence
based on response arrival order. Reject responses from a different document epoch
in the host. Studio accepts only a greater sequence, even if the supplied root is
an old autosave snapshot. Equal, older, omitted, negative, fractional, and unsafe
sequences cannot update the envelope. The first value loads normally; a changed
`replacementId` explicitly replaces the document and starts a new sequence.

A metadata acknowledgment changes only the source envelope used by the next real
local edit. It does not call `setEditorState`, clear dirty tracking, change selection
or undo history, or emit `onChange`. `revisionId` remains informational. Once this
ordered contract is used, an unsequenced update cannot fall back to automatic
external root loading; use `replacementId` for replacement. Invalid schema,
unsupported content, and resource errors do not consume either authorization.

Without this ordering prop, an identical-root metadata update remains ambiguous
and is ignored. Existing hosts keep their previous content synchronization behavior;
they must adopt this contract to acknowledge metadata safely. The envelope is a
complete snapshot, not a partial merge patch: include unknown fields that must
survive. This prop does not implement server-side concurrency or persistence.

### Gallery identity and media request ownership

Picker/upload appends reject a new item when **either** its non-empty durable asset
ID or its exact trimmed URL already exists in the gallery or earlier in that
operation. Query parameters are significant; filenames are never identities.
Existing order, repeated images, alt text, captions, layout, width and unknown
metadata are untouched. Picker append does not offer an intentional-repeat command;
existing authored repetitions remain valid and survive save/reload.

Single-media replacement requests supersede previous requests immediately,
including their upload busy state. Only the active request can change content or
show its error; obsolete upload completion cannot clear a newer upload indicator.
Gallery additions are additive and retain independent upload leases. Host picker
callbacks may throw synchronously or reject asynchronously; Studio shows a
retryable error and preserves current media. `null` is cancellation. Unsafe or
transient URLs cannot be persisted. Completion after deletion/unmount cannot
restore a card or update its component state. Hosts still own cancellation of
network work and cleanup of unused durable uploads.

`uploadMedia(file, cardType)` and `requestMedia({ cardType, source })` are host callbacks, returning durable `{ assetId, src, ... }` asset references or `null` for cancellation. Only the host can guarantee persistence and authorization. Never store `blob:` object URLs or temporary previews. Mock adapters are for tests and the playground only.

### Host recovery export

```tsx
<VibressStudio
  value={savedSource}
  onChange={handleLocalDraft}
  recoveryLocale="ar"
  onRequestRecovery={async ({ originalValue, editorState, lastAcceptedDocument, error }) => {
    await exportRecoveryInHost({ originalValue, editorState, lastAcceptedDocument, reason: error.message });
  }}
/>
```

The example assumes host-owned values/functions. `StudioRecoveryData` is exported
from `@vibress/studio-react`; `originalValue` is unknown and may not be JSON.
Choose an appropriate export format in the host and handle sensitive content
there. This callback does not save or transmit anything by itself. The action
appears only when supplied; pending requests disable duplicate activation, and
failed requests show a localized retry state. The live `editorState` and
`lastAcceptedDocument` are optional. An outgoing invalid/over-limit snapshot also
offers this route while allowing the author to repair the draft. `onChange` does
not fire for that rejected snapshot. See [interaction handoff](design-readiness-spec.md).

AI is opt-in using `enableAi` and `onAiGenerate`. The callback may be supplied full document/selection context; obtain user consent and host authorization before transmitting any private material to a provider.

## Document and serialization contract

Documents use `schema: 'vibress-studio'`, `version: 1`. Legacy `react-studio-card` nodes normalize to `studio-card`. `migrateDocument` accepts supported legacy shapes and can throw for invalid persisted data; the host must **retain the original** and avoid overwriting it with a new empty document on errors.

Historical v1 roots may omit `type`. Migration restores it only when the root
contains a `children` array or is an empty object. An empty object becomes
`{ type: 'root', children: [] }`. Existing children and root metadata remain
intact; input is not mutated. Direct validation remains strict, and explicit
wrong types, invalid children and ambiguous wrappers require recovery. Limits
are rechecked on the repaired document. This does not rewrite host database rows.

Persisted validation retains unknown envelope/editor/node metadata. Editable
admission is stricter: known nodes must have supported fields, versions and
placement; unsupported node data remains recoverable rather than being fed to a
Lexical import that could discard it. Built-in card payloads permit incomplete
authoring states but reject malformed typed fields and temporary media sources.
No schema version changes in this branch. When using the serializer directly,
pass the last accepted document as its additive third argument to preserve
envelope/editor metadata:
`serializeStudioDocument(root, limits, lastAcceptedDocument)`.

`resourceLimits` can configure `maxSizeBytes`, `maxNodeCount`, `maxDepth` and
`maxStringBytes`. The existing defaults are 5 MiB, 50,000 nodes and JSON nesting
depth 64; the per-string budget defaults to the document-size budget. Limits
reject recoverably, never truncate. Validate proposed overrides against real
publishing data; synthetic fixture results do not establish production limits.

Forward-compatible nodes and documents must survive load/save without loss. A newer document or unsupported node type must not be silently downgraded by an older editor. See [readiness evidence](production-readiness.md) and the [remediation roadmap](roadmaps/global-ux-quality-roadmap.md#16-current-authoritative-remediation-and-development-plan--2026-11-04).

## Public HTML and text rendering (server-safe)

```ts
import {
  renderStudioDocumentToHtml,
  renderStudioDocumentToPlainText,
} from '@vibress/studio-renderer';

const html = renderStudioDocumentToHtml(persistedDocument);
const excerpt = renderStudioDocumentToPlainText(persistedDocument).slice(0, 160);
```

The renderer validates/migrates input, escapes output and applies the shared parse5-backed `sanitizeStudioHtml` allowlist. Always apply a restrictive host Content Security Policy and test media/iframes and rich captions. This is **not** a blanket security certification, nor proof of editor/public color-and-caption fidelity.

## HTML and Markdown import/export

```ts
import { htmlToStudioDocument } from '@vibress/studio-html';
import { parseMarkdownToHtml, studioDocumentToMarkdown } from '@vibress/studio-markdown';

const importedHtml = htmlToStudioDocument('<p>Imported article</p>');
const importedMarkdown = htmlToStudioDocument(parseMarkdownToHtml('**Markdown article**'));
const markdownExport = studioDocumentToMarkdown(importedHtml);
```

**There is no `markdownToStudioDocument` export** in the reviewed source. Markdown is a lossy format and some cards degrade to readable placeholders. Treat exports and imports as untrusted boundaries; test safe link schemes and document fidelity. See [Import/Export contract](import-export.md).

## Plugins and host parity

The `StudioPluginRegistry` supports registration, collision checks, Zod validation and sanitized `renderCardHtml`. The React editor now accepts `pluginRegistry` and exposes registered cards through the slash menu. Plugins execute in-process and **are not security sandboxes**; only load authorized/trusted plugin code and sanitize every output boundary.

The Vibress host has Yjs collaboration exports and host-driven session lifecycle that standalone does not currently expose. **ADR-0001 remains Proposed**. Name and compare the exact host/standalone SHAs, v1 fixtures, and public exports before synchronizing.

`pnpm verify:host-compatibility --host /path/to/vibress --ref IMMUTABLE_SHA`
compares committed host core source against the same persisted fixtures, without
reading dirty host files, including relative source imports from the same commit.
At host `05446c782ab37db60d4cf6082184c2233934c2bc`, seven fixtures pass and two
differ: future document versions and envelope extensions. Its scope excludes editor commands,
public rendering, Yjs and host services; passing it alone would not prove parity.

## Host release verification

- [ ] Confirm named standalone and Vibress host SHAs, ADR decision status, and public CSS/ESM/CJS/types contracts.
- [ ] Build, lint, typecheck, unit/security/a11y/roundtrip/E2E tests and dependency audit pass at the release SHA.
- [ ] Verify real autosave + conflict protection, recovery, undo history, selection, external value sync and read-only captions.
- [ ] Confirm publication-owned media references are durable and authorization checks occur server-side.
- [ ] Compare editor, preview and published HTML for media captions, color, cards, tables and mixed Arabic/English text.
- [ ] Record visual, mobile, touch, keyboard and screen-reader evidence. Do not claim readiness from green CI alone.
