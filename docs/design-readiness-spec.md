# Program interaction and design handoff

This specification records behavior implemented on the production-readiness
branch. It is an engineering handoff, pending product/design approval. Existing
tokens live in `packages/studio-react/src/styles/tokens.css`; the exported
`studio.css` imports them and supplies standalone styling. No Figma library or
research acceptance is implied by this document.

## Recovery interaction

Invalid incoming content pauses editing in the existing editor. Preserve its
selection, undo history and draft; suppress outgoing snapshots until valid input
returns. Initially invalid input displays recovery without creating an editor.
An invalid outgoing snapshot keeps editing available so the author can repair it.
Neither case confirms a durable save.

The host supplies `onRequestRecovery` to enable export of the rejected original,
current serialized editor state when available, and last accepted document.
While export is pending, disable duplicate requests. On failure, announce a
localized message and permit retry. A completed or rejected request after
unmount must not update the UI. Technical details are collapsed by default.
`recoveryLocale="ar"` selects Arabic copy, language and direction explicitly;
article text direction does not decide the UI language.

Recovery actions have a minimum 44 CSS-pixel block size, visible keyboard focus,
wrapping text, token-based dark/light colors and logical spacing. Browser tests
exercise Arabic dark recovery at 320, 390, 768 and 1440 pixels, keyboard export
and preservation of source plus active draft. Manual contrast, zoom and screen
reader acceptance remain open.

## Card state matrix

All cards support selection, deletion, serialization and a read-only view. Empty
and partially completed authoring payloads are legitimate states; validating
their shape must not insert persisted defaults or discard unknown metadata.
Controls must update Lexical data rather than only the DOM. The following matrix
describes applicable states, not a claim that every combination is approved.

| Card | Empty / editing | Loading / failure / retry | Ready / read-only |
| --- | --- | --- | --- |
| Image | File/library entry; alt, caption and width controls | Pending source replacement; failure preserves existing asset; retry same file | Durable source and optional asset ID, rich caption |
| Gallery | Add images; additive library selection | Partial success retains successful images; retry failed files only | Ordered images and caption |
| Video | File/library entry; caption and options | Guard late completions; visible error and retry | Durable source/poster and player |
| Audio | File/library entry; title and caption | Guard late completions; visible error and retry | Durable source and audio player |
| File | File/library entry; name and caption | Guard late completions; visible error and retry | Durable download reference and metadata |
| Bookmark | URL form; metadata preview | Inline invalid-URL message; resubmit corrected URL | Link preview |
| Embed | URL entry; caption | Unsupported destinations remain safe links or an invalid-state message | Approved YouTube/Vimeo iframe or external link |
| Button | Label, URL and alignment | No upload state; invalid destination cannot bypass final sanitizer | Linked label |
| Callout | Text, emoji and background | No upload state | Sanitized content |
| Toggle | Heading and content | No upload state | Expandable details |
| Markdown | Source editor | No upload state; conversion is intentionally lossy | Sanitized rendered Markdown |
| HTML | Source editor | No upload state; raw source never bypasses sanitizer | Sanitized HTML |
| Divider | Selectable horizontal rule | No upload state | Static rule |

Media cancellation is a no-op. A response after deletion/unmount cannot restore
the card; a superseded replacement cannot overwrite a newer request. Completion
merges only permitted asset fields with the latest author metadata. Replacing a
source without a new asset ID removes the obsolete ID. Gallery additions preserve
their additive semantics rather than treating every concurrent request as a
replacement. Disabling file controls during upload does not cancel host work.

## Keyboard and responsive review

- Slash menu: arrow navigation, Enter insertion, Escape dismissal and focus return.
- URL form: Tab reaches its input and Save action in all three desktop engines.
- Selected cards: maintain node selection after browser focus processing, then
  keyboard Delete removes the intended card. Nested caption controls retain
  their own editing behavior.
- File controls: accessible names, explicit tab stops, same-file retry after the
  native input value resets. Native host/library cancellation leaves content intact.
- Recovery: alert announcement, native details toggle, keyboard export and retry.

Required manual acceptance: VoiceOver plus another screen reader, real iOS and
Android keyboards, Arabic IME, mixed-direction punctuation/URLs, 200% zoom,
reduced motion, touch positioning and a full light/dark contrast audit. Record
device/browser, source SHA, observed result and reviewer for each. Automated axe,
Lighthouse and desktop emulation cover only their tested cases.
