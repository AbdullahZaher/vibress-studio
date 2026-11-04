# Project Findings: Vibress Studio Global UX Quality Mission

## Key Architectural & Implementation Findings

### 1. Missing Design System & Standalone Stylesheet (STU-001)
- **Finding**: Previously, all typography (`studio-paragraph`, `studio-h1`, etc.), presentation width breakouts (`vb-width-wide`, `vb-width-full`), table styling, checklist layout, popover menus, and floating toolbars were defined in `vibress/apps/admin/src/styles/globals.css`. The standalone `@vibress/studio-react` package had no stylesheet export, leaving the editor unstyled in standalone playgrounds or downstream consumers.
- **Resolution**:
  - Implemented `packages/studio-react/src/styles/tokens.css` with comprehensive CSS custom properties `--vb-studio-*` bridging automatically to host Tailwind/shadcn variables (`--background`, `--foreground`, `--primary`, `--border`, `--popover`, `--muted`, `--ring`) while providing elegant editorial standalone defaults.
  - Implemented `packages/studio-react/src/styles/studio.css` containing full typography hierarchy, reading measure (740px), breakout presentation widths (960px / 100%), glassy popover menus, floating toolbars, block handle gutter, and accessible focus rings.
  - Exported `./styles.css` and `./tokens.css` from `@vibress/studio-react`'s `package.json` and bundled in `dist/styles/` during build.
  - Integrated into `playground/src/main.tsx` and configured Vite aliases for zero-configuration standalone rendering.

### 2. Node Duplication Flaw in Gutter (STU-002)
- **Finding**: In `BlockHandleGutterPlugin.tsx`, the `handleDuplicate` callback was previously creating an empty paragraph `const p = $createParagraphNode(); node.insertAfter(p);`. When authors clicked "Duplicate" on a heading, table, quote, or media card, it produced an empty paragraph rather than duplicating the content.
- **Resolution**:
  - Implemented `$deepCloneNode(node)` in `packages/studio-react/src/utils/cloneNode.ts`.
  - For `StudioCardNode` (and `ReactStudioCardNode`), clones the card type and duplicates the exact card data.
  - For `ElementNode`, uses `$parseSerializedNode(node.exportJSON())` and recursively clones and appends all child nodes (preserving text, formatting flags, styles, and links).
  - Selected the duplicated block immediately after insertion.
  - Added unit test `clone-node.test.ts` verifying paragraphs with nested formatted text, headings with tags, and `StudioCardNode` with rich payloads.

### 3. Ephemeral DOM-Only Text Coloring (STU-003)
- **Finding**: In `FloatingFormatToolbarPlugin.tsx` and `BlockHandleGutterPlugin.tsx`, applying a color was previously mutating `dom.style.color = color` on raw DOM elements. Because Lexical state was untouched, any subsequent typing, serialization, undo/redo, or page reload completely erased the applied colors.
- **Resolution**:
  - In `FloatingFormatToolbarPlugin.tsx`, replaced DOM mutation with Lexical's `$patchStyleText(selection, { color, 'background-color': bg })`.
  - In `BlockHandleGutterPlugin.tsx`, updated `handleApplyColor` to iterate through the element's text nodes and update the style string on each `TextNode` directly.
  - Added unit test `color-persistence.test.ts` verifying that colors persist in Lexical EditorState, serialize to document JSON, and restore cleanly upon rehydration in a new editor instance.

### 4. Native Browser `prompt()` for Link Insertion
- **Finding**: In `FloatingFormatToolbarPlugin.tsx`, clicking the Link button called `window.prompt('Enter link URL:')`. This blocked the JavaScript event loop, could not be styled, failed in iframe sandboxes, and provided no validation or editing capabilities.
- **Resolution**:
  - Implemented `FloatingLinkEditorPopover.tsx` with in-viewport dialog, autofocus input, automatic `https://` protocol normalization, Enter to apply, Escape to cancel, and a Remove link button when a link already exists.
  - Added unit test `link-normalization.test.ts` validating protocol preservation and automatic `https://` prefixing.

### 5. Single-Pointer Alternative & Hit Targets (WCAG 2.5.7 & 2.5.8)
- **Finding**: The block handle was limited to drag-and-drop, making block reordering inaccessible on touchscreens or for keyboard/switch users. Hit targets were 20px x 20px, violating WCAG 2.5.8 (>= 24px minimum).
- **Resolution**:
  - Added explicit "Move up" and "Move down" actions in the block handle context menu.
  - Increased block handle and floating format button targets to >= 26-28px (and >= 32-34px on mobile viewports).
  - Enabled RTL-aware placement: the gutter handle appears on the right for Arabic/RTL layouts and on the left for LTR layouts.

### 6. Media Toolbar & Card Metadata Parity (Phase 0 & Phase 3)
- **Finding**: The 6 media metadata popovers (`ImageMetadataPopover`, `GalleryMetadataPopover`, `VideoMetadataPopover`, `AudioMetadataPopover`, `FileMetadataPopover`, `EmbedMetadataPopover`) and `StudioMediaFloatingToolbar` were missing in `vibress-studio`.
- **Resolution**:
  - Synchronized components and `media-context.ts` into `packages/studio-react`.
  - Integrated into all 6 rich media card editors with complete error/retry state preservation.
