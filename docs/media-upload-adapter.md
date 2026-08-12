# Vibress Studio — Media Upload Adapter

The upload adapter decouples the editor from any specific media API. Core
packages never call a Vibress API directly — hosts provide an adapter.

## Contract

`@vibress/studio-core` (see `packages/studio-core/src/media/upload-adapter.ts`)

```ts
interface StudioUploadAdapter {
  readonly name: string;
  readonly limits?: { maxSizeBytes?: number; allowedMimeTypes?: string[] };
  upload(
    file: File,
    context: StudioUploadContext,
    handlers?: { onProgress?(p: StudioUploadProgress): void }
  ): Promise<StudioUploadedAsset>;
  abort?(uploadId: string): Promise<void>;
}

interface StudioUploadedAsset {
  id: string;
  url: string;        // persisted URL (CDN/API)
  mimeType: string;
  size: number;
  width?: number;     // images
  height?: number;    // images
  duration?: number;  // video/audio where available
  alt?: string;
  caption?: string;
}
```

`StudioUploadContext` carries `{ cardType, fileName, mimeType, size }`.

## Built-in adapters

- `MemoryUploadAdapter` — in-memory adapter for tests and local previews.
  Returns `memory://asset/<id>` URLs (not persisted).
- `VibressMediaUploadAdapter` (in `@vibress/studio-react`) — fetch-backed
  adapter for the Vibress media API or any compatible multipart endpoint:

```ts
import { VibressMediaUploadAdapter } from '@vibress/studio-react';

const adapter = new VibressMediaUploadAdapter({
  endpoint: 'https://api.yourhost.com/uploads', // never hardcoded
  authorization: 'Bearer <token>',
  limits: { maxSizeBytes: 25 * 1024 * 1024, allowedMimeTypes: ['image/*', 'video/*'] },
});
```

## Using the adapter in the editor

```tsx
<VibressStudio value={doc} onChange={setDoc} uploadAdapter={adapter} />
```

Behavior with an adapter:

1. A temporary `blob:` preview is created for the selected file.
2. `upload(file, context)` runs with progress callbacks.
3. On success the persisted `asset.url` + `asset.id` replace the preview,
   and the temporary object URL is revoked (`URL.revokeObjectURL`).
4. On failure an error overlay offers Retry or Dismiss; the preview remains
   so the author can see what failed.

Without an adapter, media cards fall back to temporary local previews
(object URLs) — never persisted.

## Validation

- Size: default 25 MB cap; adapters can lower it.
- MIME allowlist: optional.
- Errors carry machine-readable codes: `FILE_TOO_LARGE`,
  `FILE_TYPE_NOT_ALLOWED` (see `validateFileForUpload`).

## Preview URL lifecycle

Temporary object URLs are created and revoked through
`createObjectUrl` / `revokeObjectUrl` (in `@vibress/studio-react`), which
guard against environments without `URL.createObjectURL` (jsdom, SSR) and
always clean up on success, reset, and unmount.
