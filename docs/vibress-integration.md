# Vibress Studio — Integration Guide (Vibress core)

How to embed Vibress Studio into the Vibress CMS/editor host.

## Install

```bash
pnpm add @vibress/studio-react @vibress/studio-core @vibress/studio-renderer \
  @vibress/studio-cards @vibress/studio-html @vibress/studio-markdown \
  @vibress/studio-plugin-sdk
```

Peer dependencies: `react@18.3.x`, `react-dom@18.3.x`, `lexical@0.13.1`.

## Editor embedding

```tsx
import { VibressStudio, type VibressStudioProps } from '@vibress/studio-react';
import type { StudioDocument } from '@vibress/studio-core';

interface AdminEditorProps {
  initial: unknown;
  onSave: (document: StudioDocument) => void;
  /** Provided by your authenticated, publication-scoped media service. */
  uploadMedia: NonNullable<VibressStudioProps['uploadMedia']>;
}

export function AdminEditor({ initial, onSave, uploadMedia }: AdminEditorProps) {
  return (
    <VibressStudio
      value={initial}
      onChange={onSave}
      uploadMedia={uploadMedia}
      placeholder="Write content…"
    />
  );
}
```

The host's `uploadMedia(file, cardType)` implementation returns a durable
`{ assetId, src }` payload (or `null` when cancelled). It must verify the
authenticated user's publication permissions before saving any media.
`requestMedia` is an optional asset-picker callback returning the same kind
of payload, and can reject without crashing the editor.

AI is disabled unless `enableAi` is true and `onAiGenerate` is supplied.
The AI callback can receive the full current document as optional context;
only send it to an external provider after explicit consent and authorization.

## Storing documents

Persist the `StudioDocument` returned by `onChange` as JSON in the CMS
database. On load, pass it back through `value`; `migrateDocument` upgrades
legacy formats.

## Public rendering (server-side)

```tsx
import { renderStudioDocumentToHtml } from '@vibress/studio-renderer';
import { renderStudioDocumentToPlainText } from '@vibress/studio-renderer';

// In your route handler / server component:
const html = renderStudioDocumentToHtml(post.document);   // SSR-safe
const excerpt = renderStudioDocumentToPlainText(post.document).slice(0, 160);
```

This output contains no scripts, event handlers, or unsafe URLs. It is safe
to inject into a page body (subject to your own CSP for images/iframes from
allowlisted providers).

## Import from other sources

```ts
import { htmlToStudioDocument } from '@vibress/studio-html';
import { markdownToStudioDocument } from '@vibress/studio-markdown';
import { studioDocumentToMarkdown } from '@vibress/studio-markdown';

const imported = htmlToStudioDocument(legacyExportHtml);
const md = studioDocumentToMarkdown(post.document);       // for editors/exports
```

## Media flow

Media cards use the host-supplied `uploadMedia(file, cardType)` callback.
Without this callback the editor leaves the card's empty placeholder intact:
it does not persist `blob:` URLs or pretend that an upload succeeded.
Rejected uploads display a retryable error, and partial gallery uploads retry
only the failed files. See [media-upload-adapter.md](media-upload-adapter.md).

## Plugins

Third-party card registrations use `StudioPluginRegistry`. The registry
prevents duplicate or built-in card identifier collisions. The safe path for
plugin-provided HTML is `registry.renderCardHtml(type, data)`, which validates
and sanitizes the output. Do not insert raw `definition.renderHtml()` into
the DOM. Third-party plugin execution is not an isolation sandbox; untrusted
plugins require a separate security boundary.

## Security checklist for the host

- [ ] Serve pages with a CSP that restricts `script-src`; the renderer emits
      no inline scripts.
- [ ] Provide publication-authorized `uploadMedia` and never persist `blob:` URLs.
- [ ] Keep `studio-renderer`/`studio-html`/`studio-markdown` in server
      bundles only (they import no React/Lexical).
- [ ] Run `pnpm verify:package-exports` in CI before releases.
- [ ] Run `pnpm test:security` + `pnpm test:a11y` on every release.
