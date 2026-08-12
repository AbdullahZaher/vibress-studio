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
import { VibressStudio } from '@vibress/studio-react';
import { VibressMediaUploadAdapter } from '@vibress/studio-react';
import type { StudioDocument } from '@vibress/studio-core';

const adapter = new VibressMediaUploadAdapter({
  endpoint: process.env.VIBRESS_MEDIA_UPLOAD_ENDPOINT!, // injected, never hardcoded
  authorization: `Bearer ${sessionToken}`,
  limits: { maxSizeBytes: 25 * 1024 * 1024 },
});

export function AdminEditor({ initial, onSave }: { initial: unknown; onSave: (d: StudioDocument) => void }) {
  return (
    <VibressStudio
      value={initial}
      onChange={onSave}
      uploadAdapter={adapter}
      placeholder="Write content…"
    />
  );
}
```

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

Media cards use `uploadAdapter` when present. Without one, editors create
temporary local previews that are never persisted — make sure the CMS
provides an adapter in production (see
[docs/media-upload-adapter.md](media-upload-adapter.md)).

## Plugins

Third-party plugins register through `StudioPluginRegistry` with an explicit
capability manifest. By default the host sanitizes all plugin output; enable
`raw-html` only for fully trusted partners (see
[docs/plugin-sdk.md](plugin-sdk.md)).

## Security checklist for the host

- [ ] Serve pages with a CSP that restricts `script-src`; the renderer emits
      no inline scripts.
- [ ] Provide a media upload adapter; never persist `blob:` preview URLs.
- [ ] Keep `studio-renderer`/`studio-html`/`studio-markdown` in server
      bundles only (they import no React/Lexical).
- [ ] Run `pnpm verify:package-exports` in CI before releases.
- [ ] Run `pnpm test:security` + `pnpm test:a11y` on every release.
