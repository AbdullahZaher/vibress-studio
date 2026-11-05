# Vibress Studio — Source-Based Engineering and UX Reassessment

**Assessment date:** 2026-11-04  
**Standalone repository:** `AbdullahZaher/vibress-studio`  
**Reviewed standalone commit:** `be7150d04aa31e53034e832e16726a69f2c9c6e7`  
**Host reference observed:** `AbdullahZaher/vibress` at `b33fb1ab597bfabb8861516132cf8bad567f0bf1`  
**Lead role:** Editor/Lexical Architecture, with Document Architecture, Security, React UX, Accessibility/RTL and QA.  
**Status:** Source review; **not independent UX certification** and **not release approval**.

## What was verified

- The repository contains the `AGENT.md` contract, the document v1 schema, Lexical editor, built-in card editors, server-side HTML renderer, HTML/Markdown tooling, CSS-token export and automated suites.
- The 2026-11-04 GitHub Actions [run 41889641281](https://github.com/AbdullahZaher/vibress-studio/actions/runs/41889641281) succeeded for the reviewed standalone SHA: install, production audit at `--audit-level high`, lint, explicit-any guard, build, typecheck, unit tests, package exports, security, a11y and Playwright browser E2E.
- `ADR-0001` still says **Proposed**. Its host-as-canonical-runtime design is a documented proposal, not a formally accepted migration or evidence of feature parity.
- The host editor exports collaboration capabilities absent from the standalone editor's public exports; cross-repository runtime equivalence has **not** been verified.

**Not performed:** local clean-checkout commands, manual browser/real-device rendering, full screen-reader/Arabic typographic review, quantitative performance profiles, host integration tests, reproducible exploit attempts or a user study. CI success is not evidence that these untested properties pass.

## Findings register

The severity expresses potential user harm and necessary triage, **not** proof of an observed runtime failure. Each item requires a reproducing test before a behavioral fix is declared complete.

| ID | Priority | Source evidence and observation | Required verification or change |
| --- | --- | --- | --- |
| STU-R01 | P0 candidate | `studio-core/src/index.ts` `migrateDocument` returns an empty document on unknown input. A non-null unsupported persisted document could be silently replaced at an integration boundary. | Distinguish missing new-document input from invalid/unsupported stored data; preserve original and show recoverable error; test save/reload. |
| STU-R02 | P0 candidate | `studio-react/src/components/cards/ImageCardEditor.tsx` merges upload result with captured `cardData`, unlike `GalleryCardEditor`, which reads current node data. Concurrent caption edits may be overwritten. | Controlled deferred upload + caption/alt/width edits; merge only upload-owned fields into fresh node data. |
| STU-R03 | P1 | Image/gallery/video/audio/file/embed card editors alternate between `NestedCaptionEditor` and a static `figcaption` according to whether caption text exists. The first edit can unmount the active nested editor. | Browser focus/IME/edit/undo/persist tests; keep a stable caption editing surface. |
| STU-R04 | P1 | `studio-renderer/src/index.ts` does not emit `TextNode.style` for text colors/highlights; the final HTML sanitizer strips inline style. JSON color tests do not prove published fidelity. | Safe allowlisted presentation mapping and editor/save/render/preview round-trip tests. |
| STU-R05 | P1 security | `studio-markdown/src/index.ts` emits link destination `n.url` directly without Markdown escaping or using the shared URL policy. | Add protocol/escaping tests, safe destinations and deterministic lossy-fallback policy. |
| STU-R06 | P1 | Card/media UI uses numerous Tailwind utility classes; standalone `studio.css` and Vite playground do not provide a Tailwind utility stylesheet. | Standalone app visual assertions for all card states; replace hidden host CSS assumptions with scoped exported styles. |
| STU-R07 | P1 | The playground block picker shows an alert instead of inserting a block; Save Draft displays an alert with no durable save. | Wire picker to real editor commands; explicitly label save as demo-only or remove false success. Host retains persistence ownership. |
| STU-R08 | P1 | Switching preview in `playground/src/App.tsx` conditionally unmounts `VibressStudio`. | Verify focus/selection/undo continuity on preview toggle; keep editor instance mounted. |
| STU-R09 | P1 | The block handle advertises dragging without a pointer drag-reorder path; menu Move Up/Down works as an alternative. | Either implement accessible pointer reorder and non-drag alternative or correct the control's label/cursor. |
| STU-R10 | P1 | `studio.css` includes global `:focus-visible` and reduced-motion selectors, and multiple unscoped editor classes. | Host-isolation regression; scope selectors to Studio surfaces and portals without losing accessibility. |
| STU-R11 | P1 | `NestedCaptionEditor` reaches Lexical's private `_nodes` and `_config` and logs parse failures instead of visibly recovering. | Use supported registration/configuration, retain malformed raw caption, surface error and add regression fixtures. |
| STU-R12 | P1 | The source-level Markdown exporter collapses card types to `[Card: type]` and flattens numbered lists; older docs claim richer round-trips. | Explicit loss matrix plus safe readable fallbacks; exercise direction, table, captions and links. |
| STU-R13 | P1 | `studio-plugin-sdk` holds plugin card registrations, but `VibressStudio` does not take a plugin registry and the React card map is static. | Contract test for actual insert/edit/render flow or narrow feature claims to registry and safe HTML rendering only. |
| STU-R14 | P1 | Mobile/RTL rely on partial CSS rules and physical popup positions; only limited bilingual browser paths are covered. | Visual viewport matrix, mixed bidi text, soft keyboard and VoiceOver/TalkBack manual tests. |
| STU-R15 | P1 | `docs/architecture.md`, `docs/security.md`, `docs/sanitization-policy.md`, `docs/testing.md` and historical readiness claims reference removed APIs or missing tests. | Bring active docs in line with source, mark historical claims non-current, add documentation drift checks. |
| STU-R16 | P2 | `WordCountPlugin` reads the full root and updates React state on each Lexical update. | Reproducible latency/long-document profile before choosing debounce or scheduling optimizations. |
| STU-R17 | P2 | Published code blocks emit a `Copy` button from a server-rendered HTML string without an attached handler in the renderer. | Host-enhanced explicit behavior or use noninteractive markup; verify SSR-only mode. |

### Important distinctions

- `STU-R02` describes a **plausible stale-write path**, not a reproduced user report of data loss.
- `STU-R05` is a **security-hardening gap**; no exploitation was demonstrated.
- Some defects belong only to the **development playground**, not to the public `VibressStudio` API. They still matter because the playground is used to assess/editor-test usability.
- Historical CI failure notes from 2026-11-03 do not override the **successful** run above.
- The 9.82/10 score and **CERTIFIED PRODUCTION READY** text historically appended to `global-ux-quality-roadmap.md` was not supported by independent visual, host, real-device or user-study evidence. It is withdrawn as a current quality or release claim. The earlier informal 6.5/10 estimate is likewise **not** a certified product score.

## Quality evidence required for a defensible score

Use the nine-dimensional weighted rubric in [the execution roadmap](../roadmaps/global-ux-quality-roadmap.md). Each category must have a dated, independently reviewable evidence bundle: screenshots across viewports and RTL/LTR, critical-journey test recordings, security/round-trip outcomes, measured interaction profiles, and explicit reviewer sign-off. **No numeric certification score is assigned in this audit.**

## Immediate acceptance baseline

1. `schema: 'vibress-studio'`, `version: 1`; v1 cards, legacy `react-studio-card`, unknown nodes, marks, directions, tables, captions and media refs survive save/reload.
2. Persisted user content is never silently replaced with an empty document.
3. Every visible mutating action changes serializable state and survives reload; no false success notifications.
4. Server/public HTML enforces the shared sanitizer and link/embed policies; Markdown output is tested as an untrusted boundary.
5. Uploaded media refs are durable; concurrent edits, removal, retry and partial gallery success are covered.
6. Editor/preview/published HTML fidelity is compared for all supported formats; exceptions documented.
7. Author flows work in keyboard-only, RTL/LTR/mixed text and small/mobile layouts.
8. Standalone/host package contracts and host-owned persistence/collaboration are explicitly tested before distribution.

**Next:** Track the concrete work packages, acceptance criteria, owner roles, dependencies and release gates in the [remediation roadmap](../roadmaps/global-ux-quality-roadmap.md).
