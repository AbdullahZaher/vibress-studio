# Vibress Studio — World-Class Editor 9+ Delivery Plan

**Status:** PROPOSED for engineering, product, accessibility, security, and release review. Not a release approval.  
**Version:** 1.0 — 2026-11-06  
**Primary product:** [Vibress Studio](https://github.com/AbdullahZaher/vibress-studio)  
**Integration host:** [Vibress CMS](https://github.com/AbdullahZaher/vibress)  
**Canonical owner of this planning document:** Studio maintainers; implementation and release owners to be assigned.  
**Related host execution plan:** [Vibress CMS — Studio 9+ host acceptance](https://github.com/AbdullahZaher/vibress/blob/main/docs/09-studio/editor-9-plus-host-acceptance.md) (link resolves after both documentation PRs merge).

> This is a **forward-looking execution plan**, not evidence that any proposed capability ships. Actual code, reproducible tests, current CI, and signed reviews supersede historical scores and milestone claims. Never interpret a passing unit suite as approval to deploy.

## 1. Mission and product boundaries

Make Vibress Studio an author-trusted, Arabic-first, globally competitive **publishing editor**: Ghost Koenig-level writing and media polish, Gutenberg-quality discoverability and block navigation where relevant, and reliable integrations inspired by mature structured editing systems. Benchmark interactions and user tasks; **do not copy competitors' code, visual assets, or branding**.

- **Studio owns:** document admission/recovery, local editing/selection/history, cards, commands, serialization, safe rendering, accessibility of editing UI, package/extension contracts.
- **Vibress host owns:** authentication, authorization, publication identity, Post/Page lifecycle, durable media, optimistic versioned persistence, revisions, CRDT provider/room lifecycle, local-draft policy/consent, production observability, deployment/rollback.
- No standalone CMS inside Studio; no speculative complete page builder, new AI service, second CRDT backend, or persisted schema redesign.
- Preserve Studio v1 and legacy data. No silent content, metadata, or media loss. Inability to safely edit or restore must lead to an explicit **recoverable state**, not content replacement.

**Differentiator:** professional Arabic/English long-form editing, mixed-script correctness, a calm writing surface, and predictable published output.

## 2. Starting point and evidence policy

Verification snapshot on 2026-11-06:

| Area | Last verified reference | Interpretation |
| --- | --- | --- |
| Studio main | `36fac36d981ee8611b71e0ffecd978ad4773b499` | Studio [PR #34](https://github.com/AbdullahZaher/vibress-studio/pull/34) merged; independently recheck current main before implementation. |
| Host main | `08a727486eaa20d922b3decfee5cf8cff5e5d54b` | Host [PR #130](https://github.com/AbdullahZaher/vibress/pull/130) merged, including stacked cover/legacy-publication corrections. |
| Studio historical CI | [PR #34 CI](https://github.com/AbdullahZaher/vibress-studio/actions/runs/42208332673) | 515 unit tests and 256 browser cases reported passed **on that earlier PR head**; not a certification of all later commits. |
| Host main CI | [Workflow #42277615501](https://github.com/AbdullahZaher/vibress/actions/runs/42277615501) | In progress when last inspected; outcome must be refreshed and recorded, never assumed. |
| Historical deep audit | [2026-11-06 engineering audit](../audits/world-class-editor-program-2026-11-06.md) | Historical 7.1/10 weighted assessment, evidence/limitations and known release blockers. |

The historical evaluation is not a new assessment of the merged heads. Any candidate requires a fresh **immutable SHA-to-evidence manifest**, dated check results, test environment details, baseline comparison, and named sign-off.

### Baseline actions (P0)

1. Freeze source SHAs of Studio, Host and package lockfiles for the candidate; record all open incompatibility issues.
2. Run the exact repository scripts in `package.json`, frozen installs, lint, typecheck, unit/integration/security/round-trip suites, multi-engine browser tests, installed-consumer smoke tests, and production audit.
3. Reconcile the standalone and host document/renderer/card capabilities; run both directions of shared historic fixtures and published HTML parity.
4. Record proposed budgets and repeatable instrumentation on named devices (real vs emulated explicitly distinguished).
5. Inventory every P0/P1 with reproduction, owning repository, impacted data, regression test, owner, risk and release disposition.
6. Distinguish **PASS / FAIL / BLOCKED / NOT VERIFIED / NOT APPLICABLE**; lack of a run is never PASS.

**Baseline exit:** written evidence matrix; current required CI disposition; an agreed scope and acceptance owner.

## 3. Priority model and delivery policy

- **P0 — release-blocking integrity/security:** lost or overwritten author content, unauthorized exposure, unsafe CRDT restoration, broken critical publish/recovery workflow. Stop expansion until the risk is addressed or the capability is safely disabled and explicitly excluded from release.
- **P1 — required for 9+:** writing usability, Arabic/mobile, practical accessibility, performance, package/host contract reliability, safe preview/publish parity.
- **P2 — optional differentiators:** outline polish, interaction refinements, approved editorial features. Prioritize from user evidence.
- Large work must use **small, reviewable PRs**. A PR contains a failing-before reproduction where appropriate, implementation, regression checks, compatibility/safety notes, rollback and actual CI URLs.
- Protected-branch, merge, publication, production deployment and organizational sign-offs are **human-authorized**. Automated work does not confer approval.

## 4. Execution phases and acceptance

Each phase lists the owning surface, delivery, tests and its exit gate. Phases 01–03 precede broad visual feature expansion; phases 04–08 may run in parallel once data-integrity invariants are stable.

### Phase 00 — Baseline, ownership and release scope (P0)

**Owner:** Engineering lead + Product + QA (names pending).

**Deliver:** one immutable candidate evidence manifest; cross-repository gap register; risk classification; chosen collaboration/offline scope; device/browser support matrix; documented user-task protocol; architecture decision owner; acceptance gate dashboard.

**Exit:** no untracked critical issue; both repositories and release criteria have assigned decision makers.

### Phase 01 — Content integrity, host compatibility and publication correctness (P0)

**Owns:** Studio document validation/serializer/renderer + Host PostEditor/PageEditor, API and persisted fixtures.

Implement and verify:

- Studio v1, historic variants, future/opaque fields, editor/envelope metadata and durable card payloads survive safe load/save/render/reload without accidental conversion.
- Explicit `replacementId` and source-ordered `metadataRevision` contracts; `revisionId` stays informational. An obsolete echo or save acknowledgment must not replace newer user work.
- POST-first-create vs subsequent PUT ordering, page/post switching A→B→A, 409 conflict handling, a retryable error state, correct Saved/Unsaved indicators, and feature-image PATCH ownership.
- Publication/translation paths for English, Arabic and configured languages, including localized slugs and canonical URLs; published/preview HTML matches safely rendered document contracts.
- Rejected and unsupported legacy rich content remains recoverable. Read-only projections must not silently drop unknown blocks or overwrite persisted records.
- Validate safe pack/installed-consumer interoperability across both repositories before changing Lexical family or exports.

**Required adversarial tests:** A saved while B is typed; out-of-order acknowledgments; first-create race; cover A→B with reordered completion; conflicting edits; stale document loads; HTML sanitization/unsafe embed; no-op save; corrupted and future-version input; feature-image failure/retry; exact persisted envelope and media identity after refresh; tenant isolation.

**Exit (G1/G4):** zero known P0 data-loss defects in the agreed test matrix; real PostgreSQL/API save/reload and publish cases pass on the candidate; no unreviewed document schema change or lost metadata.

### Phase 02 — Coordinated Yjs revision restoration and multi-client convergence (P0)

**Owner:** Host collaboration/API/database engineer; Studio provides only tested integration hooks.

Problem: a database-only revision restore followed by editor remount can be overwritten by **retained Yjs room state**. The existing safe UI gate is an interim mitigation, **not** successful restoration.

Design and approve a protocol with:

1. Authorization and tenant/document identity checks, restored revision precondition and immutable operation identifier.
2. A documented single write authority, per-document restore epoch / fencing token and conflict barrier for concurrent saves/room updates.
3. Durable restoration of DB revision/content **and** synchronized CRDT room state using a crash-safe recovery strategy; prevent replay of pre-restore content.
4. Client broadcasts and forced reconciliation for active, reconnecting and offline peers. Old epochs cannot silently overwrite the restored epoch.
5. Idempotency, retries, process crash handling, timeout/error surfacing, observability without leaking document content, and audit records.
6. Feature-gated rollout and safe fallback: keep restoration disabled wherever the full protocol cannot be guaranteed.

**Required tests:** two/three editors; concurrent typing during restore; disconnected peer later reconnecting; delayed Redis/Yjs write; server restart between stages; stale browser tab; repeated restore; cross-publication and permission rejection; media/card state; restart + fresh reload equality across DB/CRDT/all clients.

**Exit (G2):** protocol reviewed, crash/replay tests pass, successful restore convergence proven after process restarts; disable-by-default policy retained until that evidence exists.

### Phase 03 — Offline draft durability and crash recovery (P0)

**Owner:** Host persistence UX and security; Studio supplies current safe snapshots/recovery state.

Implement an **opt-in, scoped local draft recovery policy** where appropriate, with clear acknowledgement semantics:

- Separate **locally recoverable** vs **saved to server** vs **saving** vs **conflict** states; never label an unsent edit as Saved.
- Use a bounded browser store such as IndexedDB with per-user/publication/document keying, timestamp/revision, storage quotas, retention and deletion after confirmed durable persistence.
- Treat browser storage as **best-effort**: eviction, private mode, quota errors, XSS and shared devices are threats; do not promise guaranteed backup or secret storage.
- Recover after reload/crash/offline transitions; compare local/base/server revisions; offer Keep local, Review differences, and Use server when data can be compared safely.
- Serialize tab ownership/merges safely, preserve original rejected data, avoid cross-account draft disclosure; specify logout and account-switch cleanup.
- Do not auto-replay an offline snapshot into a newer collaborative Yjs epoch.

**Required tests:** offline typing, failed save, page close/reopen, storage quota, private-mode failure, multi-tab conflict, logout/account switch, version 409, reconnect with newer server revision, collaboration restore epoch.

**Exit (G3):** no known silent loss in tested fault scenarios and clear recoverability/limits documented and accepted.

### Phase 04 — Ghost-level core writing and block UX (P1)

**Owner:** Studio editor UX + Design + Product.

- Tune calm, responsive editing surface: readable measure, paragraph and heading rhythm, sensible focus, low layout shift.
- Verify cursor, selection, composition/IME, formatting shortcuts, links, lists, table movement, undo/redo, rich clipboard and long-document navigation.
- Improve slash search/ranking, keyboard controls, Arabic/English aliases, empty/filter cases, focus return, screen-reader announcements.
- Review block gutter affordances: actual reorder/duplicate semantics, keyboard alternatives, predictable history, accessible targets; never advertise an action that does something else.
- Polish card insert/replace/remove/resize, galleries, captions, errors, media upload and safe embeds.
- Consider an outline/List View only after task-based evidence justifies it.

**Author-task acceptance:** independently observed completion of article creation, long-form formatting, gallery, image replace, embed, block move, undo, mixed-language paste, recovery, preview and publish; record time, errors, assistance and satisfaction. **Target >=95% task success** in a documented protocol with representative authors (sample and conditions published); do not invent study results.

**Exit (G5):** prioritized task flows meet accepted usability goals and P1 interaction issues have tested fixes.

### Phase 05 — Arabic-first, mobile and WCAG 2.2 AA acceptance (P1)

**Owner:** Studio accessibility/RTL + Host UI + independent manual QA.

- Mixed RTL/LTR paragraphs, Arabic numbers and punctuation, links/URLs, headings, lists, tables, selection across scripts, rich captions, paste and undo.
- Arabic diacritics, sensible typography/fallback licensing, line-height, cursor visibility, language of UI independent of content direction.
- Mobile Safari/iOS keyboard and Chrome/Android Gboard, IME composition, viewport/soft keyboard resize, pointer/touch selection, zoom and reduced motion.
- Keyboard-only card management, visible focus, dialog focus traps/return, live-region announcements, target sizes, color contrast and semantic labeling.
- Automated Playwright/axe coverage **plus** manual VoiceOver (macOS/iOS), NVDA (Windows) and TalkBack (Android) audits by named reviewers.

**Exit (G6):** applicable WCAG 2.2 AA criteria accepted; supported device/assistive-tech matrix recorded with no unresolved critical/high blockers. Automated pass alone does not certify compliance.

### Phase 06 — Measured responsiveness and long-document performance (P1)

**Owner:** Studio performance + Host preview + performance QA.

Create repeatable scenarios at 1k, 5k, 20k and 50k words, media-heavy, tables, mixed Arabic and extended typing sessions. Separate timing for Lexical commits, React re-renders, serialization, preview rendering, autosave preparation, interaction response, memory and scrolling.

**Proposed budgets** (final thresholds require owner approval and documented hardware):
- Real-user **INP p75 <= 200 ms** on supported device cohorts.
- Ordinary editing task/keystroke processing **p95 < 50 ms** in a named benchmark (not a universal promise for 50k-word stress tests).
- Stable interactions in common author documents; no unbounded memory growth in sustained editing sessions.
- Stress-mode results published even when above budget; explicitly distinguish emulated 4x CPU throttling from physical hardware.

Prior measurements with live preview under throttling reported about 186 ms media-heavy / 64 ms table / 56 ms 50k-word p95 synchronous commits. These are **historical, scenario-specific measurements, not INP**; investigate attribution before optimizing or claiming regression.

**Exit (G7):** before/after traces, methodology, hardware, INP and memory evidence meet approved release budgets without document-integrity regressions.

### Phase 07 — Preview, media and publish parity (P1)

**Owner:** Host publishing + Studio renderer + Design QA.

- Verify Studio → host safe server HTML → draft preview → actual published page/feeds for every supported card and layout.
- Validate durable media IDs/URLs, order/alt/caption/width, pending upload and retry, safe embed provider policy, multilingual SEO and canonical slugs.
- Ensure preview reflects version/permissions and rejects unsafe HTML rather than emulating execution.
- Use screenshot comparisons and text/semantic assertions on desktop/mobile and RTL/LTR; preserve robust accessible alt text.

**Exit (G5/G4):** no unexplained critical visual/semantic mismatch in the supported published output matrix; end-to-end publish/reload and translation tests pass.

### Phase 08 — Security, architecture and packaging discipline (P1)

**Owner:** Security + Package engineering + Architecture.

- Document and approve **ADR-0001** runtime/package ownership and compatibility matrix without claiming unsigned approval.
- Freeze supported Lexical family and public exports, ESM/CJS/SSR/CSS and strict Bundler/NodeNext package-consumer checks; no speculative major version jumps.
- Audit sanitizer/URL/iframe boundaries, schema validation/resource exhaustion, plugin trust boundaries, authorization, upload handling and persistence endpoints.
- Classify production vs development-tool dependency advisories; document dispositions and independent security sign-off. A clean `--prod` audit does not clear exposed development services.
- Define version/deprecation policy, migrations, rollback compatibility, telemetry privacy and runbooks.
- Plug-ins are trusted execution, **not** a sandbox.

**Exit (G0/G4/G8):** accepted architecture owner, clean critical package consumers, security disposition and backward-compatibility/rollback evidence.

### Phase 09 — Competitive acceptance, staging, release and rollback (P1)

**Owner:** Product + QA + Engineering + Security + Release.

Conduct matched, repeatable author tasks against a documented Ghost Koenig reference (and select Gutenberg/Notion/Sanity/Tiptap patterns where scope matches). Compare **task success, time, error rate, help needed and author satisfaction**, not a fabricated universal numeric ranking.

Stage an immutable paired Studio/Host release candidate:

1. Back up and snapshot staging DB, media, revisions and CRDT states.
2. Install/upgrade from representative old versions; verify saved/published documents and translations.
3. Exercise interruptions, reconnect, recovery, multi-author restore and publish parity.
4. Roll back and **verify full envelopes/cards/media/CRDT drafts**; a package-only smoke rollback is insufficient.
5. Verify observability/alerts, redaction, runbooks, release owner sign-offs and a monitored limited rollout policy.

**Exit (G9):** complete signed gate manifest, successful staging rehearsal and independently accepted product/engineering/security/release evidence. Do not deploy based on this plan alone.

## 5. Release gate tracker (not an assertion of completion)

| Gate | Acceptance evidence | Baseline status |
| --- | --- | --- |
| G0 — Ownership and CI | Both candidate SHAs, required CI on final heads, ADR owner/decision | **NOT VERIFIED** for a future candidate; ADR approval remains pending |
| G1 — Content integrity | Exact real persistence, historic fixture, conflict and no-loss scenarios | **PARTIAL / REVERIFY** |
| G2 — Collaborative restoration | Fenced REST/DB/CRDT restore with peer reconnect/crash tests | **BLOCKED** until coordinated implementation |
| G3 — Offline recovery | Multi-tab, offline, browser-crash recoverability and truthful states | **NOT VERIFIED** |
| G4 — Compatibility | Legacy, package TypeScript, render/media/schema/published-output parity | **PARTIAL / REVERIFY** |
| G5 — Writing UX | Independent matched tasks, target success and error/time evidence | **NOT VERIFIED** |
| G6 — Arabic and accessibility | Supported device + manual assistive-tech/WCAG evidence | **NOT VERIFIED** |
| G7 — Performance | Approved real-device INP, typing, memory and stress budgets | **NOT VERIFIED** |
| G8 — Security | Audit dispositions, independent review and runtime/privacy controls | **PARTIAL / REVERIFY** |
| G9 — Release | Staging upgrade/rollback and named human sign-offs | **NOT VERIFIED** |

Gate statuses must be updated from dated exact-SHA evidence. A gate cannot be passed merely by checking a box in a planning document.

## 6. Objective quality scorecard

Use six evidence-based dimensions and **keep critical release gates non-compensatory**:

| Dimension | Weight | Historical assessment (not current) | Target |
| --- | ---: | ---: | ---: |
| Content integrity / reliability | 25% | 7.6 | 9.5 |
| Writing experience / product | 20% | 7.6 | 9.2 |
| Architecture / security | 20% | 8.2 | 9.2 |
| Arabic / accessibility | 15% | 6.2 | 9.2 |
| Performance | 10% | 6.5 | 9.0 |
| Integration / release | 10% | 4.5 | 9.0 |
| **Weighted score** | **100%** | **7.09 ≈ 7.1** | **9.235 ≈ 9.24** |

**Formula:** `score = 0.25*integrity + 0.20*product + 0.20*architecture + 0.15*arabicA11y + 0.10*performance + 0.10*release`.

These are aspirational review targets, not achieved ratings. A 9+ release claim requires all relevant critical gates, independent review, reproducible tests, actual author evidence and a documented confidence level. If a P0 data-loss/security/restore issue persists, **no numerical score supersedes the release block**.

## 7. Execution workstreams, dependency order and ownership

| Track | Main repository | Start condition | Proposed accountable owner | Output |
| --- | --- | --- | --- | --- |
| A — Baseline and content integrity | Both | Immediately | Eng lead + QA | Gate G0/G1 and fixture matrix |
| B — Coordinated CRDT restore | Host | A's persistence contract agreed | Collaboration/backend lead | Safe restore protocol + tests |
| C — Offline drafts | Host + Studio hooks | A's revision/epoch contract agreed | Host UX/security | Best-effort recovery workflow |
| D — Writing and card UX | Studio | Integrity invariants pinned | Product + Studio UI | Tested author tasks and regression PRs |
| E — Arabic, mobile and accessibility | Both | Task matrix and device list agreed | RTL + a11y QA | WCAG/manual acceptance |
| F — Performance, preview and output | Both | Reliable benchmark harness | Performance + renderer | Before/after traces, parity |
| G — Distribution and security | Both | Candidate matrix prepared | Package + Security | Signed contract/audit evidence |
| H — Release evaluation | Both | Tracks A–G accepted | Release + Product + QA | Staging drill and quality decision |

**Suggested order:** baseline → integrity/publishing → Yjs/offline (critical) → UX/Arabic/performance/parity (parallelizable) → security/package acceptance → independent competitive test → staging and sign-off. Do not assign fixed deadlines without capacity and dependency review.

## 8. Required PR and evidence format

For every PR, record:
- Identified root cause or approved user need; explicit P0/P1/P2 scope and why this repository owns it.
- Base SHA/target SHA, changed APIs/data contracts and compatibility/rollback analysis.
- Reproduction before fix (where applicable), targeted tests and broader impacted suites **actually run**.
- Browser/OS/device detail for visual, Arabic and accessibility findings; raw traces for performance.
- CI run links for **final commit**, failures/skips/retries/known inherited issues and their disposition.
- Security/authorization review, no hidden content logging, no sample fixture containing private user data.
- Reviewer, gate owner, decision and outstanding risks. Do not silently mark human tasks complete.

**Definition of Done for each workstream:** implemented and tested in the correct repository, checked against host integration where relevant, documented without misleading release claims, and independently reviewed. **Definition of Done for 9+** additionally requires the accepted gate matrix and measured author experience.

## 9. Non-goals and explicit safeguards

Defer a full page builder, plugin marketplace expansion, unrelated AI product work, novel document schema fork and broad UI redesign unless product evidence establishes necessity. Never make unrelated repository changes to clear a CI dashboard. Never lower tests/coverage/security thresholds, suppress errors, silently discard unsupported content, or force a Yjs room reset without an approved coordinated protocol.

This plan does **not** authorize merging, production deployment, package publication, data migration, architectural approval, user-research claims or numeric certification.

## 10. Living review log

| Date | Update | Status |
| --- | --- | --- |
| 2026-11-06 | Created English cross-repository 9+ implementation and acceptance plan after Studio #34 and Host #130 were reported merged. | **PROPOSED**; implementation, CI and human acceptance are separate. |

**Next actions:** assign accountable owners; refresh main CI and lockfile/package-consumer evidence; create concrete Phase 01/02/03 issue/PR acceptance slices; obtain a formal ADR-0001 decision; record and prioritize the earliest independent author-testing session.

Related references: [production readiness](../production-readiness.md), [release policy](../release-policy.md), [host integration](../vibress-integration.md), [ADR-0001](../adr/0001-studio-canonical-runtime.md), and [prior deep audit](../audits/world-class-editor-program-2026-11-06.md).
