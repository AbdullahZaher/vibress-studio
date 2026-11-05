# VIBRESS STUDIO
## Product Quality, Engineering Excellence & Production Readiness Plan
**Target: 9.2+/10 Engineering Quality**  
**Document Type:** Product Requirements Document (PRD) + Engineering Execution Plan + Design Delivery Specification  
**Version:** 1.0  
**Date:** November 5, 2026  
**Status:** Proposed for engineering and design review  
**Planning Horizon:** 12 weeks, subject to discovery and technical risk  
**Primary Repository:** [AbdullahZaher/vibress-studio](https://github.com/AbdullahZaher/vibress-studio)  
**Host Application Repository:** [AbdullahZaher/vibress](https://github.com/AbdullahZaher/vibress)  
**Source Baseline:** `bac22c542c31c5edcd96229de9d4cf47bcce0c42`  

---

## 1. Executive Summary

### 1.1 Product Vision
Vibress Studio will become a reliable, secure, extensible, accessible, and high-performance rich-content editor suitable for professional publishing platforms.

The editor should combine:
- The focused writing experience of modern publishing editors.
- The extensibility of a modular block and card system.
- Strong document integrity and backward compatibility.
- High-quality Arabic, English, RTL, and mixed-direction editing.
- Secure HTML and Markdown processing.
- Predictable integration with the Vibress publishing platform.
- An independently reusable editor package with a documented integration contract.

The objective is not to reproduce every feature of Gutenberg, Ghost Koenig, or Notion. It is to build a best-in-class publishing editor for the specific needs of Vibress.

### 1.2 Current Assessment
- **Current estimated engineering quality:** 7.9/10
- **Target engineering quality:** 9.2–9.3/10
- **Production readiness:** Not independently certified.

The existing codebase demonstrates several strong architectural decisions:
- Modular TypeScript packages.
- Lexical-based React editing.
- Strict TypeScript configuration.
- Shared document schema and migration support.
- Server-safe content rendering.
- HTML sanitization.
- Card definitions and a plugin registry.
- Media upload integration.
- Automated unit, browser, security, and accessibility tests.
- Initial Arabic and RTL support.

Recent improvements have already addressed several previously documented issues. These changes should be regression-tested, not rewritten without evidence.

The remaining work focuses on strengthening correctness, integration, accessibility, performance, maintainability, and release confidence.

### 1.3 Desired Business Outcome
At the end of this program, Vibress should be able to:
- Ship editor improvements without risking existing published content.
- Support an increasing number of content types without excessive architectural complexity.
- Deliver a stable writing experience across desktop and mobile devices.
- Provide strong Arabic and multilingual publishing support.
- Integrate the standalone editor with the Vibress host application through a verified contract.
- Release editor packages with repeatable automated checks and documented rollback procedures.
- Measure product quality using reproducible evidence rather than subjective confidence.

### 1.4 Critical Principle
**Document integrity takes priority over visual polish, feature expansion, and release speed.**

The editor must never silently replace unsupported persisted content with an empty document or overwrite newer user edits because of an asynchronous update.

When safe editing cannot be guaranteed, Vibress Studio must provide a recoverable error state while preserving the original document.

---

## 2. Scope and Product Boundaries

### 2.1 In Scope
This program includes:
- Document schema hardening.
- Rendering and serialization robustness.
- Editor state synchronization.
- Media upload concurrency.
- Security hardening.
- Rich-text and card integration tests.
- Plugin SDK contracts.
- Design system and CSS isolation.
- RTL, multilingual, accessibility, and mobile experience.
- Performance measurement and optimization.
- Standalone-to-host compatibility.
- Release packaging and CI/CD improvements.
- Documentation and production acceptance.

### 2.2 Out of Scope
The following are excluded unless they are required to fix a release-blocking defect:
- Rebuilding the editor from scratch.
- Replacing Lexical with another editing framework.
- Introducing a new backend inside the editor package.
- Replacing the entire existing document schema.
- Building a complete page builder comparable to Gutenberg.
- Developing unrelated AI capabilities.
- Building a new authentication or media-storage service.
- Implementing a second, independent collaboration backend.
- Adding new card types merely to expand the feature count.

These exclusions protect the project's focus and reduce technical risk.

### 2.3 Responsibility Boundaries

#### Vibress Studio owns:
- The local editing experience.
- Lexical editor state.
- Document serialization.
- Card editing.
- Local undo and redo.
- Content validation and recovery.
- Secure content rendering.
- Editor-level commands and plugins.
- Editor-specific events and callbacks.

#### The Vibress host application owns:
- Authentication and authorization.
- Publication and user context.
- Persistent autosave.
- Revision and conflict management.
- Media storage and durable asset IDs.
- AI provider authorization.
- Collaboration sessions and providers.
- Production telemetry and operational controls.

Do not introduce duplicated ownership across these boundaries.

---

## 3. Team Structure and Accountability

### 3.1 Recommended Delivery Team

| Role | Suggested Allocation | Primary Responsibility |
|---|---|---|
| Product Manager | 0.5 FTE | Scope, prioritization, acceptance, delivery decisions |
| Engineering Lead | 1 FTE | Architecture, code review, technical quality |
| Frontend/Editor Engineers | 2 FTE | Lexical, React, cards, editor interactions |
| Platform/Integration Engineer | 0.5 FTE | Host contracts, packaging, CI, release |
| Product Designer | 1 FTE during design-intensive phases | UX, design system, responsive behavior |
| QA Automation Engineer | 1 FTE | Test architecture, Playwright, regression |
| Security Reviewer | Part-time | Threat model, sanitizer, unsafe-input validation |
| Accessibility Specialist | Part-time | WCAG, screen readers, Arabic and RTL |
| Release Owner | Part-time | Release readiness, staged deployment, rollback |

If staffing is lower than this, reduce parallel work or extend the schedule rather than weakening the acceptance criteria.

### 3.2 Decision Rights

| Decision | Accountable Owner |
|---|---|
| Scope and priority | Product Manager |
| Architectural design | Engineering Lead |
| Public document schema | Engineering Lead + Host Owner |
| User interaction behavior | Product Designer + Product Manager |
| Security acceptance | Security Reviewer |
| Test coverage acceptance | QA Lead |
| Cross-repository compatibility | Engineering Lead + Host Owner |
| Production release | Product Manager + Engineering Lead + Release Owner |

No single person should unilaterally approve a schema-breaking change or certify production readiness.

---

## 4. Definition of Success

### 4.1 Engineering Quality Scorecard
The target score will be calculated using a weighted rubric.

| Dimension | Weight | Target |
|---|---|---|
| Document integrity | 20% | 9.5 |
| Security | 15% | 9.5 |
| Testing and reliability | 15% | 9.5 |
| Architecture and maintainability | 15% | 9.0 |
| Editing UX and accessibility | 15% | 9.0 |
| Performance | 10% | 9.0 |
| Integration and release readiness | 10% | 9.0 |
| **Weighted target** | **100%** | **9.25/10** |

These are intended outcomes, not scores already achieved.  
A score above 9/10 requires documented evidence, reproducible tests, and reviewer approval.

### 4.2 Non-Negotiable Release Conditions
The release cannot be approved while any of the following remain unresolved:
- A reproducible critical data-loss scenario.
- Silent replacement of unsupported persisted content.
- A confirmed exploitable critical or high-severity vulnerability without an approved mitigation.
- A critical editor workflow that fails in a supported environment.
- An incompatible persisted-document change without a tested migration and rollback.
- An unresolved host integration issue that can overwrite user edits.
- A required CI validation that is failing or bypassed without explicit approval.

A numerical score must never override these conditions.

---

## 5. Delivery Strategy and Schedule

### 5.1 Twelve-Week Delivery Plan

| Phase | Timing | Primary Outcome | Exit Gate |
|---|---|---|---|
| 0. Baseline and ownership | Week 1 | Approved architecture and measured baseline | G0 |
| 1. Data integrity and synchronization | Weeks 2–3 | Safe persisted-document lifecycle | G1 |
| 2. Security and reliability testing | Weeks 3–5 | Hardened trust boundaries and meaningful regression coverage | G2 |
| 3. Design system and extensibility | Weeks 5–7 | Consistent, independently integrated editor UI | G3 |
| 4. Performance and accessibility | Weeks 7–9 | Measured responsiveness and validated editing accessibility | G4 |
| 5. Host compatibility and release engineering | Weeks 9–11 | Reproducible integration and release candidate | G5 |
| 6. Independent audit and rollout | Week 12 | Production release decision | G6 |

Some activities must begin earlier than their primary phase. In particular, host compatibility discovery and the Lexical upgrade investigation should start during the initial weeks.

The schedule is an estimate for planning and is subject to the results of discovery.

### 5.2 Milestone Definitions
- **Milestone M0 — Approved Baseline:** A dated architecture decision, current source baseline, defect inventory, test inventory, and performance baseline are available.
- **Milestone M1 — Content Safety:** The editor can safely handle supported, legacy, malformed, and forward-compatible documents according to documented rules.
- **Milestone M2 — Reliable Editing:** Controlled editing, concurrent uploads, state synchronization, undo/redo, and content persistence pass integration tests.
- **Milestone M3 — UX and SDK Quality:** The standalone editor works without hidden styling dependencies, and documented plugin functionality matches observed behavior.
- **Milestone M4 — Measured Quality:** Performance, accessibility, keyboard navigation, RTL, and mobile checks meet agreed targets.
- **Milestone M5 — Release Candidate:** Both repositories pass compatibility checks, package artifacts are validated, and rollback is demonstrated.
- **Milestone M6 — Release Approval:** An independent reviewer accepts the evidence, no blocking defects remain, and the accountable owners sign off.

---

## 6. EPIC A — Architecture Governance and Baseline
**Priority:** P0  
**Owner:** Engineering Lead  
**Supporting Roles:** Product Manager, Host Engineering, QA  
**Target:** Week 1  

### 6.1 Problem
The standalone `vibress-studio` repository and the main `vibress` application contain related editor implementations, but their capabilities and release contracts have historically differed.

The existing ADR proposes that the main Vibress application remain authoritative for the currently deployed runtime, while the standalone repository becomes a controlled distribution target. That proposal needs an explicit decision and a verified compatibility process.

### 6.2 Engineering Tasks
- **STU-101 — Establish the source of truth:**
  - Review and approve or revise `docs/adr/0001-studio-canonical-runtime.md`.
  - Identify the authoritative source for each editor package.
  - Record the exact source commits used in the review.
  - Define which team may change document serialization contracts.
  - Identify who approves synchronization between repositories.
- **STU-102 — Build a capability matrix:**
  - Compare host and standalone versions for document schema, card types, editor commands, plugin registration, media upload, AI callbacks, collaboration, CSS and design tokens, public package exports, HTML/Markdown rendering, and revision/autosave integration.
  - Classify each difference as supported, intentionally host-only, missing, incompatible, or deprecated.
- **STU-103 — Establish baselines:**
  - Record current automated test results, existing package exports, known reproducible defects, Lighthouse and accessibility results, editor startup and typing performance, current artifact sizes, dependency versions, and supported browsers and devices.

### 6.3 Deliverables
- Approved architecture decision record.
- Repository ownership matrix.
- Capability comparison report.
- Baseline measurements.
- Prioritized defect register.
- Written scope freeze for the release.

### 6.4 Acceptance Criteria
- One authoritative runtime strategy is approved.
- Each cross-repository package has a named owner.
- Unsupported feature differences are explicitly documented.
- No release depends on unreviewed source copying.
- All subsequent tickets reference the approved baseline commit.

---

## 7. EPIC B — Document Integrity and Schema Hardening
**Priority:** P0  
**Owner:** Core/Editor Engineering  
**Target:** Weeks 2–3  

### 7.1 Source Finding
`packages/studio-core/src/index.ts` historically accepted `root.children` using `z.array(z.unknown())`. This supports forward compatibility, but it does not guarantee that every downstream renderer can safely process every known node's fields. For example, a malformed heading node may contain a non-string tag, while rendering logic expects a string. The solution must improve safety without destroying unknown data.

### 7.2 Required Architecture
Introduce clear validation boundaries:
- **A. Persisted Document Validation:** Checks the document envelope, version metadata, root shape, depth, size, and structural safety. It must preserve unknown fields and unknown node types when possible.
- **B. Editable Document Validation:** Determines whether the current editor can load and edit the document without losing unsupported content.
- **C. Renderable Node Validation:** Ensures each known node contains the types expected by the HTML and plain-text renderers.
- **D. Recovery and Error Classification:** Returns typed errors for invalid, unsupported, or corrupted documents, with enough context to offer recovery.

Do not replace a forward-compatible document with a rewritten schema simply to make validation easier.

### 7.3 Engineering Tickets
- **STU-201 — Define typed node schemas:**
  - Create runtime validators for supported node families: Paragraphs, headings, text and formatting, lists and list items, links and automatic links, tables, rows, cells, code blocks, studio cards, and legacy card nodes.
  - Retain a non-destructive policy for unknown nodes.
- **STU-202 — Harden renderer input:**
  - Audit every use of unchecked node properties.
  - Replace unsafe assumptions with schema validation, explicit type guards, safe fallbacks where appropriate, and typed errors when fallback would lose meaning.
  - Rendering must never rely on an uncontrolled cast from unknown input.
- **STU-203 — Introduce resource limits:**
  - Define configurable limits for maximum serialized document size, maximum node count, maximum nesting depth, maximum text and attribute size, and maximum recursive transformation depth.
  - Proposed limits: 5 MB serialized content, 50,000 nodes, nesting depth 64.
  - Exceeding a limit must produce a recoverable error, not silent truncation.
- **STU-204 — Expand migration tests:**
  - Create fixtures covering current schema version, historical schema variants, legacy `react-studio-card`, unknown future nodes, missing or invalid fields, malformed JSON, extremely nested structures, Arabic and mixed-direction content, corrupt media metadata, and large documents.
- **STU-205 — Implement safe recovery UX:**
  - When a document cannot safely be edited: do not enable ordinary editing; display a clear localized error; retain the original document; provide a safe export/recovery route through the host; do not automatically save a replacement document.

### 7.4 Design Requirements
Design a document recovery screen with:
- A precise but understandable error explanation.
- A clear indication that editing has been paused.
- A way to contact support or report the problem.
- A recovery/export action when supported by the host.
- Accessible focus and keyboard navigation.
- Arabic and English copy.

Avoid claiming that data is safely stored unless the application has confirmed that fact.

### 7.5 Acceptance Criteria
- All supported document fixtures load and round-trip successfully.
- Unknown nodes remain preserved in the original persisted representation.
- Malformed renderer inputs do not crash the entire published page.
- No unsupported document is silently overwritten.
- Recovery UI and error reporting are verified in browser tests.
- Critical validation and migration branches meet the agreed coverage threshold.

---

## 8. EPIC C — Editor State Synchronization and Persistence Contracts
**Priority:** P0  
**Owner:** Editor Engineering + Host Engineering  
**Target:** Weeks 2–4  

### 8.1 Problem
`DocumentSyncPlugin` compares incoming serialized content with the editor's current state and may replace the Lexical state when differences are detected. This is a reasonable baseline, but stale network responses, delayed parent updates, and multiple editing events require explicit concurrency rules. A defect is not considered confirmed until reproduced through integration testing.

### 8.2 Required State Model
Define three independent concepts:
- **Local editor revision:** tracks local changes.
- **Host persistence revision:** identifies the server-confirmed version.
- **External document update:** represents a change received from outside the current editing session.

Do not assume these are interchangeable. The host application should provide revision identifiers or an equivalent monotonic update contract.

### 8.3 Engineering Tickets
- **STU-301 — Document the controlled-editor contract:**
  - Specify when `value` should be applied, when `onChange` should fire, how parent echo updates are identified, how external updates are differentiated, how unsupported external data is handled, and how selection and history should behave.
- **STU-302 — Prevent stale update overwrites:**
  - Create a host integration test with controlled deferred responses: User types revision A; Host begins saving A; User types revision B; Save acknowledgment for A arrives late; Editor must retain B.
  - Use revision metadata or an equivalent explicit synchronization mechanism (`revisionId`, `replacementId`). Avoid relying only on JSON equality for concurrency decisions.
- **STU-303 — Preserve editor continuity:**
  - Test that non-substantive updates do not remount the editor, reset selection, lose the local undo stack, change focus, or reinitialize an active caption editor.
- **STU-304 — Handle real conflicts:**
  - Define host behavior when another session updates the same document. Host must either apply an approved collaboration model or detect the revision conflict and present a recovery/merge decision.
  - Never silently apply last-write-wins for conflicting author changes unless that policy has been explicitly accepted.

### 8.4 Acceptance Criteria
- Parent echo updates do not reset selection or history.
- Stale responses cannot overwrite newer local changes in tested scenarios.
- Conflict tests are deterministic.
- Reload displays the last confirmed saved revision.
- Local unsaved content remains recoverable after recoverable save failures.
- Studio and the host retain their documented responsibilities.

---

## 9. EPIC D — Security and Trust Boundaries
**Priority:** P0/P1  
**Owner:** Security Reviewer + Platform Engineering  
**Target:** Weeks 3–5  

### 9.1 Security Objectives
Secure every boundary where content moves between:
- Imported HTML.
- Markdown.
- Editor state.
- Card definitions.
- Plugin renderers.
- URL inputs.
- Media metadata.
- Server-rendered output.

The existing parse5-backed allowlist sanitizer is a strong starting point and should be retained unless independent testing reveals a reason to replace it.

### 9.2 Engineering Tickets
- **STU-401 — Harden URL handling:**
  - Context-specific URL rules for links, images, media sources, and iframes.
  - Validate protocol, host where required, dangerous character normalization, encoded protocol attempts, relative URL behavior, and invalid/unusually long inputs.
  - For `target="_blank"`, enforce `noopener noreferrer` even when another `rel` value already exists.
- **STU-402 — Expand HTML sanitization tests:**
  - Test script and event-handler injection, HTML parser edge cases, SVG and MathML payloads, encoded/obfuscated URLs, CSS injection, dangerous attributes, malformed nesting, iframe provider restrictions, and plugin-generated HTML.
- **STU-403 — Secure Markdown import and export:**
  - Verify escaping of link destinations, safe protocol handling, Markdown-to-HTML transformations, readable fallbacks for unsupported cards, and preservation rules for supported formatting. Document which conversions are intentionally lossy.
- **STU-404 — Verify plugin trust model:**
  - Public Plugin SDK executes extensions in-process; explicitly document as un-sandboxed.
  - Permit only trusted and approved plugin code; sanitize plugin-rendered HTML; validate plugin card input; prevent card-type collisions; test malformed and throwing plugin implementations.
- **STU-405 — Establish security release checks:**
  - Dependency audit (`pnpm audit --prod`), static analysis where practical, security regression suite, manual review of high-risk rendering paths, vulnerability triage, and written disposition of unresolved findings.

### 9.3 Acceptance Criteria
- No confirmed critical or high-severity exploit remains unresolved without approved mitigation.
- XSS regression fixtures pass.
- HTML and Markdown outputs preserve intended safe content.
- Unsafe destinations are rejected.
- Plugin rendering cannot bypass the documented HTML sanitization boundary.
- Security reviewers approve the final implementation.

---

## 10. EPIC E — Media and Card Reliability
**Priority:** P1  
**Owner:** Editor Engineering  
**Target:** Weeks 3–6  

### 10.1 Objective
Every media and content card must behave predictably during loading, editing, failure, deletion, and recovery. Real React components must be verified under realistic asynchronous conditions.

### 10.2 Engineering Tickets
- **STU-501 — Replace simulated tests with component-level integration tests:**
  - Mount actual components (e.g. `ImageCardEditor`) with a real test Lexical editor.
  - Use controlled upload adapters that can resolve successfully, return invalid data, reject, resolve after card deletion, resolve after caption/alt-text changes, and resolve after editor unmount. Assert actual serialized editor state.
- **STU-502 — Verify durable media references:**
  - Editor must not persist browser-only `blob:` references as published media.
  - Verify asset IDs and URLs remain valid after save, reload, preview, export, and reopening the document.
- **STU-503 — Standardize card lifecycle states:**
  - Every applicable card must support clearly defined states: Empty, Selected, Editing, Uploading/loading, Ready, Error, Retry, Read-only, Disabled or unavailable.
- **STU-504 — Standardize error and retry behavior:**
  - Failed upload must not erase an existing valid media asset.
  - Retry must not create duplicate cards.
  - Deleting a card while an upload is pending must not recreate it.
  - A late response must not overwrite newer edits.
  - Errors must be presented in a useful, accessible way.
- **STU-505 — Verify caption editing:**
  - Check first-character entry, focus continuity, formatting, undo/redo, Arabic and English composition, save/reload, and recovery from malformed caption data.

### 10.3 Design Deliverables
Produce a complete state matrix for the supported card types:
Image, Gallery, Video, Audio, File, Bookmark, Embed, Button, Callout, Toggle, Markdown, HTML, and Divider.  
For each, specify visible states, controls, error messages, loading indicators, and keyboard behavior.

### 10.4 Acceptance Criteria
- Each supported card has passing critical-journey browser tests.
- Retry and deletion behave correctly under delayed responses.
- Real component tests cover asynchronous editing races.
- User-authored metadata survives valid upload completion.
- Card behavior and design state documentation agree.

---

## 11. EPIC F — Design System, UX Consistency, and Accessibility
**Priority:** P1  
**Owner:** Product Designer + Frontend Engineering  
**Target:** Weeks 5–9  

### 11.1 Design Objective
Vibress Studio must feel like one coherent product, not a collection of separately styled plugins. Writing should remain the primary focus while keeping advanced controls discoverable.

### 11.2 Core Design Principles
- **Content first:** Writing remains the primary visual focus.
- **Progressive disclosure:** Advanced formatting appears when relevant.
- **Predictability:** The same action behaves consistently across cards.
- **Keyboard accessibility:** Important actions must not require a pointer.
- **Bidirectional correctness:** Arabic, English, and mixed-direction content treated as core scenarios.
- **Recoverability:** Every destructive or failure-prone action has a clear recovery model.

### 11.3 Required Design Deliverables
- **DES-101 — Design audit:** Typography, spacing, color contrast, controls, toolbars, menus, empty states, error states, loading states, mobile interactions, dark mode, RTL behavior.
- **DES-102 — Design tokens:** CSS custom properties for colors, spacing scale, border radii, shadows, layer elevation, motion durations, and light/dark themes.
- **DES-103 — Component specifications:** Main editing canvas, slash command menu, inline formatting toolbar, block handle, card toolbar, media selection, metadata popovers, captions, table controls, inline AI interface, document recovery screen, upload error and retry UI.
- **DES-104 — Interaction specifications:** Mouse/touch interactions, keyboard activation, Escape behavior, focus entry/exit, disabled/loading behavior, error feedback, reduced-motion behavior.
- **DES-105 — RTL and multilingual design:** Arabic-only, English-only, mixed Arabic/English, URLs inside RTL, numbers/punctuation, tables, captions, code blocks (preserving LTR), nested lists, selection menus, popover positioning.
- **DES-106 — Mobile design:** Layouts for 320 px, 390 px, 768 px, 1440 px. Verify no unwanted horizontal scrolling. Target comfortable touch controls (44 × 44 CSS pixels recommended).

### 11.4 CSS Engineering Requirements
- Scope editor selectors beneath the Studio root or use namespaced classes.
- Ensure portaled components receive correct theme tokens.
- Remove undocumented assumptions about host Tailwind utilities.
- Make exported stylesheet sufficient for standalone integration.
- Avoid modifying unrelated host components.
- Add visual regression tests for representative states.

### 11.5 Accessibility Standard
- Target WCAG 2.2 AA for applicable editor interactions.
- Manual verification: Keyboard-only editing, screen-reader navigation (VoiceOver and at least one additional screen reader), focus visibility, dialog/popover focus management, accessible names, error announcements, color contrast, reduced motion, zoom/text resizing, RTL and mixed-direction content.

### 11.6 Design Acceptance Criteria
- Design specifications approved before substantial implementation.
- No critical keyboard or screen-reader blocker remains.
- No severe clipping or horizontal overflow in supported viewport matrix.
- Light and dark themes meet contrast requirements.
- RTL layouts manually reviewed.
- Standalone editor matches approved designs without undocumented host CSS.

---

## 12. EPIC G — Plugin SDK and Architectural Maintainability
**Priority:** P1  
**Owner:** Engineering Lead  
**Target:** Weeks 5–8  

### 12.1 Objective
Make extension behavior explicit, type-safe, testable, and backward-compatible.

### 12.2 Engineering Tickets
- **STU-701 — Formalize plugin capabilities:**
  - Review public Plugin SDK contract: Custom cards, slash menu discovery, toolbar contributions, rendering, plain-text export, validation, registration conflicts, unsupported extensions. Verify end-to-end behavior or document limitations accurately.
- **STU-702 — Introduce versioned extension contracts:**
  - Document supported plugin API version, required card definition fields, compatibility policy, deprecation process, failure behavior, registry lifecycle, and trusted-plugin restrictions.
- **STU-703 — Improve code maintainability:**
  - Review large UI modules (e.g. `SlashMenuPlugin.tsx`). Extract command definitions, menu metadata, card insertion actions, navigation logic, positioning helpers, and presentation components where useful.
- **STU-704 — Audit TypeScript escape hatches:**
  - Track intentional casts and unsafe boundaries. Prioritize casts surrounding deserialized content, plugin payloads, card data, DOM integration, and external callbacks. Keep `explicit-any` at 0.
- **STU-705 — Correct documentation drift:**
  - Update implementation examples, supported APIs, and security docs to accurately reflect current parse5-based sanitizer and runtime capabilities.

### 12.3 Acceptance Criteria
- Every public API has a working example and a contract test.
- Undocumented behavior is not required for normal integration.
- Plugin registration failures do not leave partial state.
- Documentation matches implementation.
- Major editor components have focused unit or integration tests.
- Architectural review approves any new public API.

---

## 13. EPIC H — Performance and Responsiveness
**Priority:** P1  
**Owner:** Editor Engineering + QA  
**Target:** Weeks 7–9  

### 13.1 Objective
Maintain responsive editing performance under real publishing workloads.

### 13.2 Test Scenarios
Benchmark: Empty document, 1,000-word article, 5,000-word article, 20,000-word article, large table, media-heavy document, mixed Arabic/English document, multiple embedded cards, repeated undo/redo, rapid typing and paste, opening/closing popovers repeatedly across desktop and mobile.

### 13.3 Proposed Performance Budgets

| Metric | Initial Target |
|---|---|
| Interaction to Next Paint (INP) | ≤ 200 ms |
| Editor key processing p95 | ≤ 50 ms |
| Slash menu response | ≤ 100 ms |
| 5,000-word document initialization on baseline desktop | ≤ 1 second |
| 5,000-word initialization on baseline mobile | ≤ 2 seconds |
| 20,000-word document | Remains usable without data loss |
| Repeated editor interactions | No sustained memory growth attributable to a leak |

Budgets must be confirmed against named test device, browser version, dataset, and baseline before becoming hard release gates.

### 13.4 Engineering Tickets
- **STU-801 — Create reproducible benchmarks:** Record device, browser, CPU conditions, test document, package version, measurement method, p50/p95 latency, and memory usage.
- **STU-802 — Profile editor updates:** Review Lexical update listeners, full-document serialization, React rerenders, word counting, menu filtering, card state updates, portal positioning, upload progress handling. Optimize only confirmed bottlenecks.
- **STU-803 — Prevent performance regressions:** Add automated benchmark checks for critical scenarios in pre-release pipelines.

### 13.5 Acceptance Criteria
- Performance reports are reproducible.
- No critical interaction exceeds accepted budget without documented exception.
- Large-document testing passes.
- Optimizations preserve editor behavior and undo history.
- Improvements supported by before-and-after measurements.

---

## 14. EPIC I — Dependency and Lexical Upgrade Strategy
**Priority:** P1  
**Owner:** Engineering Lead  
**Discovery Target:** Weeks 2–3  

### 14.1 Objective
Reduce long-term framework maintenance risk without introducing document incompatibilities. Pinned Lexical is currently 0.13.1; an upgrade must not be treated as a routine dependency bump.

### 14.2 Required Investigation
Create an isolated technical spike comparing 0.13.1 with proposed target release. Review:
- Serialized node compatibility.
- Custom card nodes.
- Replacement nodes.
- Nested caption editors.
- Selection handling.
- History.
- Tables.
- Slash menus.
- Plugins.
- React integration.
- Host collaboration compatibility.

### 14.3 Decision Framework
- **Option A — Upgrade within this program:** Choose only if spike demonstrates manageable API changes and passing document-compatibility tests.
- **Option B — Remain temporarily on current version:** Choose if migration risks current user documents or host collaboration. Document the risk, establish supported maintenance strategy, create separate migration project, and keep visible in release report.

Targeting 9+/10 should not be achieved by rushing an unsafe framework migration.

### 14.4 Acceptance Criteria
- Written upgrade recommendation exists.
- Compatibility fixtures are reusable.
- No untested document format change is approved.
- Host and standalone version strategy is explicit.

---

## 15. EPIC J — Host Integration and Release Engineering
**Priority:** P1  
**Owner:** Platform/Integration Engineer  
**Target:** Weeks 9–11  

### 15.1 Objective
Make the editor usable and maintainable across both the standalone package and the Vibress application.

### 15.2 Engineering Tickets
- **STU-901 — Build a host compatibility suite:** Run identical fixtures through supported integrations in both repositories, verifying input document acceptance, serialized output, card data, public HTML rendering, media references, RTL and formatting, public commands, plugin behavior, and collaboration configurations.
- **STU-902 — Verify package exports:** Test installation from built distribution artifact in a clean consumer application. Confirm imports work without private deep paths, types resolve, ESM/CJS contracts behave as documented, stylesheets are available, and no undeclared workspace dependencies are required.
- **STU-903 — Establish versioning and release rules:** Define SemVer policy, backward compatibility requirements, changelog process, release tagging, package publication criteria, and resolve private package status before public distribution.
- **STU-904 — Implement a safe release strategy:** Staged rollout in host application (Internal -> Canary -> Expanded -> Full GA) with error telemetry monitoring.
- **STU-905 — Demonstrate rollback:** Verify previous compatible editor version can be restored without damaging documents created during rollout.

### 15.3 Acceptance Criteria
- Clean installation succeeds.
- Public package contracts are verified.
- Host integration tests pass.
- Release version and changelog are complete.
- Rollback is documented and tested.
- No major capability difference remains undocumented.

---

## 16. QA Strategy

### 16.1 Testing Pyramid
- **Unit Tests:** Validators, migrations, serialization, sanitization, URL handling, card definitions, helper functions, state transformations.
- **Integration Tests:** Actual React editor components, Lexical editor updates, card interactions, media upload callbacks, plugin registry, controlled value and `onChange` behavior, host adapters.
- **Browser E2E Tests:** Complete author journeys (create document, enter/format text, insert card, edit metadata, upload media, save, reload, preview, export, confirm published output).
- **Manual Tests:** Real mobile keyboards, screen readers, Arabic/mixed-direction composition, visual quality, focus transitions, unusual content.

### 16.2 Browser Matrix

| Platform | Required Testing |
|---|---|
| Chromium Desktop | Automated E2E |
| Firefox Desktop | Automated E2E |
| WebKit Desktop | Automated E2E |
| iOS Safari | Manual critical journeys |
| Android Chrome | Manual critical journeys |
| Desktop keyboard-only | Manual and automated |
| VoiceOver | Manual accessibility |
| Additional screen reader | Manual accessibility |

### 16.3 Coverage Targets
Risk-based coverage over meaningless global percentages:
- At least 90% branch coverage for critical document validation, migration, serialization, and sanitization modules where practical.
- Complete regression tests for all confirmed P0 defects.
- Real-component tests for critical media race conditions.
- Browser coverage for every primary publishing workflow.
- Zero accepted critical tests that are flaky or skipped.

### 16.4 Test Data Requirements
Versioned fixture library including:
- Historical Vibress documents.
- Valid current documents.
- Invalid documents.
- Future/unknown node types.
- All built-in card types.
- Arabic/English mixed text.
- Tables and lists.
- Corrupt media data.
- Malicious HTML and Markdown.
- Long-form articles.
- Large and deeply nested documents.

### 16.5 Continuous Integration
Required pull request checks:
- Dependency installation from frozen lockfile.
- Lint (`eslint .`).
- Typecheck (`tsc --noEmit`).
- Verify explicit-any (`node scripts/count-explicit-any.mjs --max 50`).
- Build (`pnpm -r build`).
- Package export validation (`node scripts/verify-package-exports.mjs`).
- Unit, security, accessibility, roundtrip tests.
- Critical browser E2E (Playwright).
- Documentation consistency checks.

Do not hide test failures behind unconditional `continue-on-error` settings.

---

## 17. Design Team Execution Plan

### 17.1 Required Figma Structure
Create a shared design file containing:
- **Page 1 — Design Foundations:** Tokens, typography, spacing, color, elevation, focus styles, responsive rules.
- **Page 2 — Editor Components:** Canvas, formatting toolbar, slash menu, block handle, floating panels, dialogs.
- **Page 3 — Content Cards:** Each built-in card type, all applicable states, metadata editing, error and recovery states.
- **Page 4 — Responsive Layouts:** Mobile compact (320px), mobile standard (390px), tablet (768px), desktop (1440px).
- **Page 5 — RTL and Multilingual:** Arabic editing, mixed scripts, lists, tables, captions, menus, code.
- **Page 6 — Accessibility:** Focus order, keyboard interactions, screen-reader labels, announcements, contrast, reduced-motion behavior.
- **Page 7 — Developer Handoff:** Measurements, component behavior, responsive rules, token mappings, acceptance annotations.

### 17.2 Design Review Process
Every major component must pass four reviews:
1. **Product review:** Is the interaction understandable and aligned with publishing workflows?
2. **Design review:** Is it consistent with the system?
3. **Engineering review:** Is the implementation feasible and maintainable?
4. **Accessibility review:** Can it be used without relying on visual or pointer-only interaction?

A component is not complete simply because it visually resembles its Figma design.

### 17.3 UX Research
Recruit representative authors and editors, including Arabic-first users.  
Tasks: Create and format an article, insert images and captions, create a table, insert an embed, correct an upload failure, use keyboard-only controls, switch between writing and preview, edit mixed Arabic and English content.  
Measure task completion, errors, confusion, and subjective usability. Convert findings into prioritized issues.

---

## 18. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Document schema changes break old content | Critical | Versioned fixtures, migration tests, no silent rewrites |
| Stale external updates overwrite user edits | Critical | Revision-aware host contract, delayed-response tests |
| Lexical upgrade causes compatibility regressions | High | Isolated spike, gated migration, rollback |
| Standalone and host repositories diverge | High | Approved ownership ADR and parity suite |
| Security sanitizer changes remove valid content | High | Before/after output fixtures and security review |
| CSS changes break the host application | Medium/High | Namespacing, visual tests, canary integration |
| Browser tests are flaky | Medium | Deterministic fixtures, controlled network, flakiness tracking |
| Mobile/RTL issues escape automation | High | Manual device and screen-reader acceptance |
| Plugin implementations crash rendering | High | Validation, trusted plugin policy, error isolation |
| Scope expands to unrelated features | High | Product change control and scope freeze |

Risks must have named owners and be reviewed weekly.

---

## 19. Release Gates

### G0 — Architecture Gate
- **Required evidence:** Approved source-of-truth decision, capability matrix, baseline metrics, reviewed scope and release plan.

### G1 — Integrity Gate
- **Required evidence:** Migration tests, invalid-input tests, unknown-node preservation, synchronization tests, zero unresolved confirmed critical content-loss defects.

### G2 — Security and Reliability Gate
- **Required evidence:** Sanitizer and URL regression tests, real-component media tests, security review, reliable critical CI checks.

### G3 — Design and Accessibility Gate
- **Required evidence:** Approved design components, standalone CSS integration, responsive screenshots, RTL review, keyboard and screen-reader test results.

### G4 — Performance Gate
- **Required evidence:** Reproducible benchmark report, accepted performance results, zero unresolved release-blocking responsiveness defects.

### G5 — Integration Gate
- **Required evidence:** Host compatibility suite, package installation tests, changelog and versioning, rollback test, release candidate build.

### G6 — Final Release Gate
- **Required evidence:** All blocking gates passed, independent technical review, security approval, UX/accessibility approval, product acceptance, release owner approval.

No gate is automatically passed because its implementation tickets are closed. Evidence must be attached.

---

## 20. GitHub Work Breakdown

| Ticket | Title | Priority | Owner |
|---|---|---|---|
| STU-101 | Approve canonical runtime ownership | P0 | Engineering Lead |
| STU-102 | Build cross-repository capability matrix | P0 | Platform |
| STU-103 | Establish quality and performance baseline | P0 | QA |
| STU-201 | Add typed document node validation | P0 | Core Engineering |
| STU-202 | Harden renderer against malformed input | P0 | Core Engineering |
| STU-203 | Define non-destructive document resource limits | P1 | Core Engineering |
| STU-204 | Expand migration and compatibility fixtures | P0 | QA + Core |
| STU-205 | Implement document recovery experience | P0 | Design + Frontend |
| STU-301 | Define controlled-editor synchronization contract | P0 | Editor + Host |
| STU-302 | Prevent stale external update overwrites | P0 | Editor + Host |
| STU-303 | Test focus, selection, and undo continuity | P1 | QA |
| STU-304 | Define and verify host conflict behavior | P0 | Host |
| STU-401 | Harden link and media URL policies | P1 | Security + Core |
| STU-402 | Expand HTML/XSS regression coverage | P1 | Security |
| STU-403 | Validate Markdown import/export safety | P1 | Core |
| STU-404 | Verify trusted plugin security model | P1 | Platform |
| STU-405 | Establish security release checks | P1 | Security |
| STU-501 | Add real-component media concurrency tests | P1 | Editor + QA |
| STU-502 | Verify durable asset references | P1 | Editor + Host |
| STU-503 | Standardize card state behavior | P1 | Design + Frontend |
| STU-504 | Standardize upload error and retry behavior | P1 | Frontend |
| STU-505 | Verify caption editing and recovery | P1 | Editor + QA |
| DES-101 | Complete editor UX audit | P1 | Design |
| DES-102 | Define design tokens and themes | P1 | Design |
| DES-103 | Produce component specifications | P1 | Design |
| DES-104 | Document interaction and focus behavior | P1 | Design |
| DES-105 | Validate Arabic and mixed-direction UX | P1 | Design + QA |
| DES-106 | Validate mobile layouts and touch interactions | P1 | Design + QA |
| STU-701 | Formalize Plugin SDK capability contracts | P1 | Platform |
| STU-702 | Define extension API compatibility policy | P1 | Platform |
| STU-703 | Refactor confirmed high-complexity editor modules | P2 | Frontend |
| STU-704 | Audit unsafe TypeScript boundaries | P1 | Engineering |
| STU-705 | Remove documentation drift | P1 | Engineering |
| STU-801 | Build reproducible performance benchmarks | P1 | QA |
| STU-802 | Optimize measured editor bottlenecks | P1 | Editor |
| STU-803 | Add performance regression monitoring | P1 | QA |
| STU-901 | Implement host compatibility tests | P0 | Platform + Host |
| STU-902 | Verify built package exports and CSS | P1 | Platform |
| STU-903 | Define package versioning and release rules | P1 | Engineering Lead |
| STU-904 | Configure staged release and monitoring | P1 | Release Owner |
| STU-905 | Test rollback and recovery | P0 | Release Owner |

Do not execute all tickets simultaneously. Use dependencies and milestone gates to determine order.

---

## 21. Standard Definition of Done

Every engineering ticket must satisfy the following:
- The change has a clearly stated user or technical outcome.
- Acceptance criteria are defined before implementation.
- A failing regression test is added first when addressing a reproducible defect.
- Relevant unit and integration tests pass.
- No unsupported document change is introduced.
- TypeScript, lint, and build checks pass.
- Security-sensitive paths receive appropriate review.
- UX changes match approved interaction specifications.
- RTL and accessibility impact is considered.
- Documentation and API examples are updated when applicable.
- The pull request includes evidence and screenshots where relevant.
- Rollback or compatibility implications are documented.
- An appropriate reviewer approves the change.
- Product acceptance is recorded for user-facing changes.

A merged pull request is not automatically a completed product outcome. The corresponding verification gate must also pass.

---

## 22. Pull Request Template

Every substantive PR should include:
- **Title:** Ticket ID and descriptive change.
- **Problem:** What confirmed problem or risk does this address?
- **Root Cause:** What causes the behavior, if known?
- **Proposed Solution:** What is changing, and why was this approach selected?
- **Alternatives Considered:** What simpler or safer options were evaluated?
- **Compatibility Impact:** Does this affect persisted documents, public APIs, the host, or plugins?
- **Testing Evidence:** Which tests were added or executed? Include exact commands and results.
- **Security and Accessibility Impact:** Identify relevant trust boundaries and user interaction impacts.
- **Screenshots or Recordings:** Required for meaningful UI changes.
- **Rollback Plan:** How can the change be reversed safely?
- **Reviewer Sign-Off:** Identify appropriate technical and product reviewers.

---

## 23. Weekly Operating Cadence

- **Monday — Planning and Risk Review:** Review milestone status, gate status, critical defects, dependencies, scope changes, engineering capacity.
- **Midweek — Design and Engineering Review:** Review UX implementation against specs, API decisions, compatibility risks, security changes, cross-team decisions.
- **Friday — Demonstration and Evidence Review:** Demonstrate completed behavior (actual implementation, not mockups), attaching screenshots, test outputs, benchmark comparisons, open defects, updated risk status.
- **Weekly Product Report:** PM publishes completed outcomes, next-week priorities, milestone confidence, blocking issues, quality trends, decisions needed, release risks.

---

## 24. Quality Metrics and Monitoring

### 24.1 Pre-Release Metrics
Track critical regression pass rate, confirmed P0/P1 open defects, branch coverage in critical modules, E2E test stability, input latency, editor startup latency, package size trends, accessibility failures, host compatibility failures, and design acceptance findings.

### 24.2 Production Metrics
Where supported by host, track privacy-preserving signals: Editor initialization failures, failed document loads, save conflict events, recoverable editor errors, upload failure and retry rates, unexpected editor remounts, critical rendering failures.  
*Avoid logging raw article text, document bodies, access tokens, or sensitive media URLs.*

### 24.3 Quality Score Reviews
Scores reviewed at three milestones: Initial baseline, release candidate, and post-release stabilization. Must include links to supporting evidence. Do not award 9+/10 based solely on green CI or ticket counts.

---

## 25. Launch and Rollback Strategy

### 25.1 Pre-Launch
Freeze release candidate, run full validation suite, verify supported document fixtures, complete manual accessibility checks, confirm host compatibility, complete security review, verify package artifacts, approve rollback procedures.

### 25.2 Controlled Rollout
Recommended sequence: Internal users -> Limited canary audience -> Expanded audience after monitoring -> General availability after approval. Expansion depends on error rates, content integrity, and user-impact evidence.

### 25.3 Rollback Triggers
Stop or reverse rollout when:
- A confirmed content-loss defect appears.
- Save conflicts are silently resolved incorrectly.
- The editor cannot load previously valid documents.
- A high-severity security issue is confirmed.
- Critical authoring workflows regress materially.
- Error or performance metrics exceed approved thresholds.

Rollback must preserve user's latest recoverable content and avoid schema incompatibilities.

---

## 26. Final Delivery Package

At project completion, deliver:
- **Engineering:** Reviewed and merged source code, approved architecture decisions, updated public API contracts, document compatibility fixtures, test suites and results, performance reports, security assessment, package and dependency documentation.
- **Design:** Final Figma library, responsive specifications, light/dark themes, RTL specifications, card state matrix, keyboard and accessibility specifications, UX research findings and resolutions.
- **Product:** Final requirements and scope record, completed acceptance criteria, known limitations, release notes, user-facing documentation, prioritized post-release backlog.
- **Release and Operations:** Release candidate artifacts, version and changelog, monitoring dashboard, tested rollback instructions, production sign-off record.

---

## 27. Final Acceptance Checklist

The project can be recommended for a 9+/10 assessment only when supported by evidence:
- [ ] A canonical runtime and ownership strategy is approved.
- [ ] Existing supported documents retain their data through save/reload.
- [ ] Unsupported documents are not silently overwritten.
- [ ] Malformed renderer inputs are handled safely.
- [ ] External update and stale-save scenarios pass.
- [ ] Actual media editing components pass concurrency tests.
- [ ] HTML, Markdown, link, and plugin security boundaries pass review.
- [ ] Standalone styling works without hidden host CSS dependencies.
- [ ] Editor cards have consistent approved states and interactions.
- [ ] Keyboard and screen-reader critical workflows pass.
- [ ] Arabic, RTL, and mixed-direction editing are manually verified.
- [ ] Mobile layouts meet responsive and touch usability requirements.
- [ ] Performance budgets are measured and accepted.
- [ ] Public plugin APIs match their documentation and tests.
- [ ] Cross-repository compatibility is verified.
- [ ] Dependency and Lexical upgrade decisions are documented.
- [ ] Release packaging is reproducible.
- [ ] A rollback exercise succeeds.
- [ ] No unresolved release-blocking defect remains.
- [ ] Independent technical, security, design, and product approval is recorded.

---

## 28. Product Management Recommendation

Vibress Studio already has a promising technical foundation. The most valuable next investment is not expanding the feature set, but turning that foundation into a trustworthy product that can be maintained and released with confidence.

The recommended execution order is:
1. Approve architecture ownership and establish the baseline.
2. Fix document validation and state synchronization risks.
3. Prove reliability through real-component and integration tests.
4. Harden security boundaries.
5. Standardize the UX and isolate the design system.
6. Validate accessibility, RTL, mobile behavior, and performance.
7. Formalize plugin APIs and package contracts.
8. Verify compatibility with the main Vibress application.
9. Complete independent acceptance and staged release.

Reaching 9.2+/10 is a reasonable engineering objective if these outcomes are demonstrably achieved. The final score should be determined only after the release candidate passes the agreed assessment rubric.

**Final directive to the team:**  
Prioritize user content safety, editor reliability, and predictable publishing workflows above feature quantity. Preserve backward compatibility, prove each significant fix with meaningful tests, and require objective evidence before claiming production readiness. The goal is not simply to make Vibress Studio appear more complete. It is to make it demonstrably reliable, secure, accessible, performant, and maintainable.
