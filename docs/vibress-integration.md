# Vibress Studio — Host Integration Contract

**Source reviewed:** standalone `main` at `ff283b03a023f90d33e96543e2d408b3287bdc75` (2026-11-05). Read [ADR-0001](adr/0001-studio-canonical-runtime.md) and [architecture](architecture.md) before integrating with the separately maintained Vibress CMS.

Studio is a **reusable editor library**, not the CMS. The host owns identity, publication permissions, persistence, autosave, version-conflict handling, durable media, AI authorization and collaboration lifecycle.

## Installing from source

The standalone workspace packages currently declare `"private": true` and version `0.1.0`. **They are not documented as published npm packages.** Work within a checked-out workspace or an explicitly tested internal package distribution:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm verify:package-exports
```

Public imports use `@vibress/studio-*` package export maps. React 18.3, React DOM 18.3 and Lexical 0.13.1 are pinned in the standalone workspace. Do not copy another repository's editor files or deep-import package internals to simulate host parity.

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

`uploadMedia(file, cardType)` and `requestMedia({ cardType, source })` are host callbacks, returning durable `{ assetId, src, ... }` asset references or `null` for cancellation. Only the host can guarantee persistence and authorization. Never store `blob:` object URLs or temporary previews. Mock adapters are for tests and the playground only.

AI is opt-in using `enableAi` and `onAiGenerate`. The callback may be supplied full document/selection context; obtain user consent and host authorization before transmitting any private material to a provider.

## Document and serialization contract

Documents use `schema: 'vibress-studio'`, `version: 1`. Legacy `react-studio-card` nodes normalize to `studio-card`. `migrateDocument` accepts supported legacy shapes and can throw for invalid persisted data; the host must **retain the original** and avoid overwriting it with a new empty document on errors.

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

The `StudioPluginRegistry` supports registration, collision checks, Zod validation and sanitized `renderCardHtml`. On the reviewed `main`, the React editor does **not** accept a plugin registry prop or automatically expose registered card editors in the slash menu. This integration remains proposed in [PR #17](https://github.com/AbdullahZaher/vibress-studio/pull/17).

The Vibress host has Yjs collaboration exports and host-driven session lifecycle that standalone does not currently expose. **ADR-0001 remains Proposed**. Name and compare the exact host/standalone SHAs, v1 fixtures, and public exports before synchronizing.

## Host release verification

- [ ] Confirm named standalone and Vibress host SHAs, ADR decision status, and public CSS/ESM/CJS/types contracts.
- [ ] Build, lint, typecheck, unit/security/a11y/roundtrip/E2E tests and dependency audit pass at the release SHA.
- [ ] Verify real autosave + conflict protection, recovery, undo history, selection, external value sync and read-only captions.
- [ ] Confirm publication-owned media references are durable and authorization checks occur server-side.
- [ ] Compare editor, preview and published HTML for media captions, color, cards, tables and mixed Arabic/English text.
- [ ] Record visual, mobile, touch, keyboard and screen-reader evidence. Do not claim readiness from green CI alone.
