# Task Plan: Vibress Studio Global UX Quality Mission

## Goal
Conduct an independent, critical review of the Vibress Studio Global UX Quality Roadmap, improve it, and execute all phases (Phase 0 through Phase 8) to achieve a verified, measurable UI/UX quality score of at least 9.7/10 across visual design, functional reliability, editorial experience, design system, Arabic/RTL, touch/responsiveness, accessibility, performance, and preview fidelity.

## Strategy & Principles
1. **Manus Working Memory**: Maintain persistent state in `task_plan.md`, `findings.md`, and `progress.md`.
2. **Canonical Alignment**: Per ADR-0001 (Option B), `vibress` monorepo is the active runtime canonical source. Synchronize capabilities into `vibress-studio` with complete contract tests.
3. **No-Regressions Invariant**: Document schema remains `vibress-studio` v1. Never destroy user content, remount the editor destructively, or break serialization.
4. **Honest Affordances**: Every button, menu, handle, and shortcut must do exactly what it claims. No empty paragraph duplicates, no DOM-only fake color formatting, no browser native `prompt()`, no simulated AI.
5. **Universal Portability & Tokens**: Standalone Studio must ship clean, encapsulated CSS with CSS variables bridging to host theme tokens, with robust dark mode and RTL support.

## Execution Phases

### Phase A: Independent Roadmap & Architectural Review
- [ ] Thoroughly inspect code, tests, CI, and UX across `vibress-studio` and `vibress`
- [ ] Audit industry-leading editors (Notion, Ghost, Gutenberg, Lexical) against current implementation
- [ ] Identify discrepancies, architectural risks, and missing requirements
- [ ] Update `docs/roadmaps/global-ux-quality-roadmap.md` with critical findings, improved sequencing, and measurable scoring criteria

### Phase 0: Canonical Baseline, Parity Inventory & Reproducible Fixtures
- [ ] Formally approve ADR-0001
- [ ] Port missing host capabilities into `vibress-studio`:
  - `StudioMediaFloatingToolbar` and 6 media metadata popovers (`ImageMetadataPopover`, `GalleryMetadataPopover`, `VideoMetadataPopover`, `AudioMetadataPopover`, `FileMetadataPopover`, `EmbedMetadataPopover`)
  - `StudioMediaContext` and `media-context.ts`
  - Reconcile `VibressStudioProps` and component hierarchy
- [ ] Verify baseline tests, lockfile, and package exports

### Phase 1: Portable Design System, Tokens & Standalone Stylesheet
- [ ] Create comprehensive standalone design tokens in `packages/studio-react/src/styles/tokens.css` (canvas, surfaces, borders, text, radii, focus ring, elevations)
- [ ] Establish bridge to Vibress Admin CSS variables (`--background`, `--foreground`, `--primary`, `--border`, etc.) with standalone fallbacks
- [ ] Export `packages/studio-react/src/styles/studio.css` (or dist css) and export from package entry
- [ ] Eliminate hardcoded `#1e293b`, `#334155` ad-hoc colors across plugins and toolbars
- [ ] Support Light Mode, Dark Mode, and `prefers-reduced-motion`

### Phase 2: Core Editor Interactions, Formatting & State Correctness
- [ ] Fix STU-002: Rewrite `handleDuplicate` to clone the complete Lexical node and its children/state, maintaining selection and undo
- [ ] Fix STU-003: Rewrite `handleApplyColor` to use durable Lexical text styles (`$patchStyleText` / format state) rather than raw DOM style mutations
- [ ] Replace native `prompt()` link dialog with an accessible, in-viewport `LinkEditorPopover` with validation, keyboard shortcuts (Enter/Escape), and focus management
- [ ] Add explicit Move Up and Move Down actions to block handle gutter for both pointer and keyboard
- [ ] Add unit and regression tests for duplicate, text color persistence across serialization/reload, and link popover

### Phase 3: Rich Cards, Media Workflows & Metadata Parity
- [ ] Integrate `StudioMediaFloatingToolbar` and 6 metadata popovers into `vibress-studio`
- [ ] Ensure all 13 card types have complete state handling (Empty, Hover, Focus, Selected, Editing, Uploading, Error/Retry, ReadOnly, Dark, RTL)
- [ ] Guarantee upload adapter contract compliance: zero blob URLs persisted, clear error messages with retry
- [ ] Safe link fallback for bookmarks without external scraping

### Phase 4: Mobile, Touch, RTL & Mixed-Script Parity
- [ ] Replace fixed pixel widths/offsets with logical CSS properties (`inset-inline`, `margin-inline`, `border-inline`)
- [ ] Implement mobile-responsive bottom sheet / floating drawer for slash commands and formatting on small viewports (<= 768px)
- [ ] Ensure WCAG 2.5.8 touch target size (minimum 24x24px, recommended 40-44px for touch)
- [ ] Full Arabic RTL testing: block handles on the correct side, mixed-direction text selection, directional table navigation

### Phase 5: Accessibility (WCAG 2.2 AA) & Inclusive Design
- [ ] Full keyboard navigation across all menus, block handles, toolbars, and card popovers
- [ ] Visible, high-contrast focus rings (`:focus-visible`) matching design tokens
- [ ] Screen-reader accessible names (`aria-label`, `aria-expanded`, `aria-haspopup`, `role="toolbar"`, `role="menu"`)
- [ ] Single-pointer non-drag alternative for block reordering (WCAG 2.5.7)
- [ ] Run axe-core accessibility checks and verify 0 violations

### Phase 6: Reliability, Integration & Performance Hardening
- [ ] Verify non-destructive editor lifecycle (no key-based remounting during save)
- [ ] Test roundtrip serialization with complex multi-card documents, tables, and mixed RTL
- [ ] Performance benchmarks on large documents (1000+ paragraphs, 50+ cards)
- [ ] Verify clean dependencies and 0 security audit advisories

### Phase 7: Host-Mediated AI & Provider Contract
- [ ] Verify opt-in `enableAi` and `onAiGenerate` contracts
- [ ] Clean error handling, loading states, and dismissibility without leaking secrets or fabricating text
- [ ] Undo/Redo integration for AI replacements

### Phase 8: Verification, Final Certification & Delivery
- [ ] Execute full test suite: unit, security, a11y, roundtrip, typecheck, lint, package-exports
- [ ] Sync verified improvements back to integration host (`vibress`) where needed
- [ ] Capture before/after visual and functional evidence
- [ ] Perform independent evaluation and compute final weighted score (Target >= 9.7/10)
- [ ] Prepare final deliverables and production readiness verdict
