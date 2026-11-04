# Integrating with React

The standalone editor is exposed from `@vibress/studio-react`. The host controls the document value, authorization, persistence and durable media storage.

## Public props

The `VibressStudioProps` interface currently defines `value`, `onChange`, `onEditorReady`, `readOnly`, `placeholder`, `onError`, `requestMedia`, `uploadMedia`, `allowUnsplash`, `showWordCount`, `enableAi` and `onAiGenerate`. Check [the source](https://github.com/AbdullahZaher/vibress-studio/blob/main/packages/studio-react/src/VibressStudio.tsx) for the current contract.

```tsx
import { useState } from 'react'
import { createEmptyStudioDocument, type StudioDocument } from '@vibress/studio-core'
import { VibressStudio } from '@vibress/studio-react'
import '@vibress/studio-react/styles.css'

export function ContentEditor() {
  const [document, setDocument] = useState<StudioDocument>(
    createEmptyStudioDocument()
  )

  return <VibressStudio value={document} onChange={setDocument} />
}
```

This is a **local state example**, not a save implementation. The host must persist `StudioDocument` as JSON and handle version conflicts, authorization and reload. Do not remount the editor on each save or overwrite unacknowledged edits.

## Media and AI

Use the host-provided [upload/picker contracts](/media-upload-adapter) for durable media assets. Never persist temporary `blob:` URLs or embed storage credentials in the editor.

AI is off by default. It requires both `enableAi` and `onAiGenerate`. The host must authorize requests, protect credentials and obtain consent before sending document context to external services.

## Server-side rendering

```ts
import { renderStudioDocumentToHtml } from '@vibress/studio-renderer'

// On the server, after checking the document's publication permissions:
const html = renderStudioDocumentToHtml(document)
```

Treat all imported content and card data as untrusted, and maintain a suitable Content Security Policy. See [Security](/security) and [Sanitization policy](/sanitization-policy).

::: info Release caveat
The standalone package currently declares `private: true`; this page demonstrates public package exports for workspace/source integrations and does **not** claim the packages are already published to a registry. Review [package exports](/package-exports) and [ADR-0001](/adr/0001-studio-canonical-runtime).
:::
