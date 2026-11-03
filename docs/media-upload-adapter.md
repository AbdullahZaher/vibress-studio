# Vibress Studio — Host Media Integration

Studio's React editor does not upload files on its own. The hosting CMS
supplies a durable, authenticated upload callback; the editor never receives
storage credentials or accesses another publication directly.

## Current public React contract

```tsx
import type { VibressStudioProps } from '@vibress/studio-react';

const uploadMedia: NonNullable<VibressStudioProps['uploadMedia']> =
  async (file: File, cardType: string) => {
    // Supply this through your host app, using a checked user session and
    // authoritative publication context; do not trust a caller-supplied ID.
    const asset = await uploadToAuthorizedPublication(file, cardType);
    return { assetId: asset.id, src: asset.url };
  };

<VibressStudio value={doc} onChange={setDoc} uploadMedia={uploadMedia} />
```

Here `uploadToAuthorizedPublication` is an application-provided function,
**not** a library export. Never embed media API tokens or storage secrets
in client-side JavaScript. The callback must validate file size and MIME,
authorization and ownership, malware policy and storage quotas server-side.
Successful uploads return a durable `src` and ideally an `assetId`.
Returning `null` cancels the operation; rejection marks an upload as failed.

## Author experience and asynchronous safety

- Image, video, audio, and file cards preserve the current node metadata when
  their upload finishes, instead of overwriting captions with stale props.
- A failed upload leaves the empty card editable and offers Retry and Dismiss.
  Retries do not rely on temporary `blob:` URLs.
- Gallery partial success appends completed files once. Only failed files are
  offered for retry, preventing duplicates of successfully uploaded media.
- `requestMedia({ cardType })` is an optional host asset-picker API. A
  rejected picker shows an accessible error while keeping the inserted card.
  Results of a picker for a removed card are ignored; nonempty author edits
  made while it was pending are preserved.
- Never persist transient `blob:`, `memory:`, or local object URLs as CMS
  content. Existing documents should continue to use their durable assets.

## Backward compatibility

The persisted Studio card schema is unchanged. Integrations must use the
current `uploadMedia` property, not the deprecated documentation example
`uploadAdapter` (which is not a `VibressStudioProps` property). The host
remains responsible for retries, duplicate upload requests, timeouts and
storage-level idempotency.
