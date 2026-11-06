# World-class editor program — verified delivery, 2026-11-06

## 1. Executive summary

This execution delivered the highest-priority safe reliability and distribution
work, rather than treating the entire product program as complete. Two focused
draft PRs follow merged Studio PR #33: [Studio #34](https://github.com/AbdullahZaher/vibress-studio/pull/34)
and [host #130](https://github.com/AbdullahZaher/vibress/pull/130).

Host drafts now have explicit replacement/ordered metadata contracts, mounted
recovery, document request ownership and strict editable admission. Metadata is
preserved at envelope, editor and opaque card-payload boundaries. Studio's clean
strict package consumers pass with the smallest evaluated compatible Lexical
engine family. No persisted schema migration or host engine upgrade was made.

Independent re-review found no unresolved actionable correctness issue in the
focused corrections. Its conservative assessment is **7.1/10**, not release
certification. The overall decision is **NOT READY FOR PRODUCTION**: coordinated
Yjs restoration, host-wide verification, manual acceptance and release approvals
remain open, and measured throttled-browser performance misses proposed budgets.

## 2. Latest repository verification

| Repository | Verified main baseline | Implementation source | Delivery |
| --- | --- | --- | --- |
| Studio | `0bd19cb21b21a2e6c703c80d6dce3d5f432ca723` | `5da7066f0ceb93e173425fff04697a29ca8b8286` | `codex/studio-package-contract`, PR #34 |
| Host | `c641ed063f79ceb109988ec19692338a319c8b96` | `cb0be3f03460cc57143e43db093c523e27b4cf0d` | `codex/studio-host-integrity`, PR #130 |

These are immutable implementation/evidence SHAs. Subsequent evidence-only
commits are identified by the PR head; they do not change the reviewed behavior.
Studio PR #33 was already merged when execution began and was not expanded or
reimplemented. Its merged-main [CI](https://github.com/AbdullahZaher/vibress-studio/actions/runs/42101065331)
and [documentation build](https://github.com/AbdullahZaher/vibress-studio/actions/runs/42101065330)
passed. Host main [CI](https://github.com/AbdullahZaher/vibress/actions/runs/42073778572)
was already failing.

The primary host checkout belongs to ongoing CI work. At the final inspection it
was `fix/ci-remediation-and-perf@81106fd581160e2cd42470d0caae155b833cff9f`
with unrelated local changes. It was not edited, reset, switched or committed by
this execution. Host implementation used the existing owned managed worktree.
Inspect the current PR checks for final workflow results; this report does not
turn an in-progress run into a pass.

## 3. Engineering findings matrix

[Recorded failing-before summaries](data/reproductions-before-2026-11-06.json)
are from working candidates before their corresponding corrections. Each reported
issue was investigated; already-merged CR-01/02/03 work was not repeated.

| Finding | Classification / severity | Evidence and user impact | Implemented strategy / test |
| --- | --- | --- | --- |
| Historical roots omit `type` | Confirmed defect / P1 | Valid legacy content rejected as INVALID_STUDIO_DOCUMENT | Repair only unambiguous absent discriminators; retain ambiguous original; root/recovery regressions |
| Envelope/editor metadata stripped | Confirmed defect / P1 | Source fields disappear after validation/save | Permissive persisted envelope, admitted source serialization; metadata/reload tests |
| Stale same/shorter-root echoes replace edits | Confirmed defect / P1 | Newer author draft can be overwritten | Dirty guard, explicit replacement, source-ordered metadata revision; actual Lexical tests |
| Invalid external input unmounts draft | Confirmed defect / P1 | Selection/history and active content lost | Pause mounted editor, suppress snapshots, retain original; recovery/undo/selection tests |
| Obsolete post/page loads and save completions | Confirmed defect / P1 | Another document's fields/version applied, including A→B→A | Mounted document epochs/disposal; deferred post/page regressions |
| Edits during revision restore | Confirmed defect / P1 | Later draft overwritten by restore completion | Noncollaborative request ownership/generation; keep later draft and resume save |
| Retained Yjs room overrides restored database | Confirmed defect / P1, release-blocked | Real mounted Lexical/Yjs reproduction retains old room content after remount | Default UI restore gated before confirmation/HTTP, disabled controls with explanation; coordinated API/room protocol still required |
| Registered node forward fields disappear | Confirmed defect / P1 | Paragraph/text/root annotations dropped by Lexical | Strict host editable-node admission, separate from persisted validation; three mounted failures reproduced then fixed |
| Opaque metadata interpreted as nodes | Confirmed defect / P2 | Legacy discriminator inside metadata rewritten, including repeated canonical card reload | Normalize actual AST positions only; envelope/editor/card/root metadata, idempotence and immutability regressions in both repos |
| Serializer evaluates accessors before rejection | Confirmed defect / P2 | Host-controlled getters execute across admission boundary | Descriptor/resource preflight before property reads/spreads; getter counter remains zero |
| Numeric element alignment admitted then lost | Confirmed defect / P2 | Lexical exports nonzero numeric alignment as empty string | Persist original; reject unsupported numeric alignment into recovery; retain historical zero/default and supported strings |
| Strict installed TS7016/TS2677 | Confirmed defect / P1 | Supported external consumer cannot typecheck | Coherent 0.14.3 family, native ESM adapter, clean strict Bundler/NodeNext CI gates |
| Playground uses second engine | Confirmed defect / P1 during evaluation | Browser boots with incompatible editor contexts | Align all 32 declarations; tested playground-inclusive pin guard |
| Slow heavy throttled-browser interactions | Reproducible weakness / P1 acceptance | Media/table/50k synchronous timings exceed proposed budget | Raw benchmark evidence and exact profiling backlog; no speculative optimization claim |
| Human usability, physical a11y, staging/rollback | Missing verification / release-blocking | No valid evidence for requested acceptance | Explicit owner-dependent gates and protocol below |
| Host future-version migration refusal | Intended trade-off | Host refuses editing, preserves exact raw input | Nine persisted/recovery fixture cases pass; future case explicitly recovery-only, not runtime parity |

## 4. Source changes and compatibility

Host `packages/studio-core/src/index.ts` preserves unknown envelope/editor data,
limits legacy repair to safe root shapes and normalizes only AST positions.
`editable-node-schemas.ts` supplies the host's registered 0.13 editable shapes.
Unknown fields remain valid persisted JSON; editing routes them to recovery.
`studio-serializer` adds an optional source envelope and preflights accessors and
resources before reads. It refuses future-source downgrades.

Host `VibressStudio.tsx` replaces the word-count synchronization heuristic with
explicit replacement, source-ordered metadata and dirty-draft ownership. A
metadata acknowledgment does not replace the root, selection or history, or emit
an onChange. `revisionId` is informational. `metadataRevision` is monotonic within
a replacement epoch and assigned by the metadata source, never arrival order.
Invalid input does not consume authorization or replace the draft. Unknown
metadata survives the next emitted local change.

`PostEditor` and `PageEditor` wire the server version into the metadata contract
and reject obsolete network completions. Noncollaborative restore protects edits
made after confirmation. Default collaborative restore is disabled with visible
English/Arabic reasons in both revision controls; its guard runs before HTTP
mutation. The optional noncollaborative mode is frozen at mount. It is not a
workaround for an active or retained room, and the REST endpoint is not a
coordinated restore protocol.

Studio package manifests and playground pin Lexical 0.14.3. Published 0.13.1
contains declarations but lacks the necessary type/export manifest entries.
0.14.3 was the earliest evaluated stable fix without a new paragraph field;
0.14.5/0.15.0 evaluations failed two existing integrity cases and were rejected.
The ESM adapter supports CommonJS and native ESM namespaces without bundling
private editor copies. See [ADR-0003](../adr/0003-lexical-maintenance-investigation.md).

Canonical Studio v1, legacy cards and host-facing existing calls remain
supported. Additive metadata/replacement/recovery APIs do not authorize a schema
migration. The legacy `editor.lexicalVersion` hint remains unchanged; manifests
identify the installed engine. Host's mixed dependency/Yjs graph was not upgraded
or replaced. Package compatibility is not host runtime equivalence.

## 5. Verification matrix

Results below distinguish local targeted evidence from host-wide CI. Counts
within specialized suites overlap the complete unit suite and are not additive.

| Actual command / scope | Verified result |
| --- | --- |
| Studio `pnpm install --frozen-lockfile` | Pass |
| Studio `pnpm lint` | Pass, 0 errors; existing warnings remain |
| Studio `pnpm verify:explicit-any` | Pass, 0 against max 50 |
| Studio `pnpm verify:lexical` | Pass, 32 exact declarations / 14 package directories |
| `node --test scripts/*.node-test.mjs` | 5 pass, 0 skipped |
| Studio `pnpm build`, `pnpm typecheck` | Pass |
| Studio `pnpm test:coverage` | 515 tests / 54 files pass, no skips; existing critical gates pass |
| Critical coverage | Statements 94.88%, branches 93.64%, functions 92.75%, lines 96.27% |
| `pnpm test:security`, `pnpm test:a11y`, `pnpm test:roundtrip` | Final explicit runs: 22 / 2 / 29 pass; also included in the complete unit suite |
| `pnpm verify:package-exports`, `pnpm verify:consumer-imports` | Pass; public ESM/CJS/CSS/SSR paths checked |
| `pnpm verify:packed-consumer` and `--strict-nodenext` | Both pass on clean installed tarballs, without skipLibCheck or declaration patches |
| `pnpm docs:build` | Pass including this evidence report and its data links |
| `pnpm test:e2e` | 256 Chromium/Firefox/WebKit cases pass locally and in inspected implementation-source CI, no skipped/retried cases |
| `pnpm benchmark:editor` | 16 scenarios pass as measurement/retained-text checks, not performance-budget acceptance |
| `pnpm benchmark:document` | Six workloads pass, including 50k words |
| `pnpm verify:host-compatibility --host ... --ref cb0be3f...` | 9 persisted/recovery fixtures pass; future case recovery-only |
| Host `pnpm install --frozen-lockfile`, `pnpm verify:explicit-any` | Pass; existing max 220 unchanged |
| Host focused `vitest.studio-recovery.config.ts` | 89 tests / 16 files pass, no skips; mounted React/Lexical plus isolated engine probe |
| Host isolated `vitest.studio-integration.config.ts` | 18 tests / 2 files pass, no skips: authenticated API/PostgreSQL persistence 4 + WebSocket/Yjs/Redis 14 |
| Host core/serializer/React builds, admin typecheck | Pass; unused import found by final check was removed and typecheck rerun successfully |
| Host scoped ESLint | Pass; local Nx module-boundary rule reports no cached graph, so full CI lint remains separate evidence |
| `pnpm audit --prod --json`, both repositories | Pass, no production advisories |
| Studio `pnpm audit --json` | Fails: 25 development-tool advisories (7 high, 16 moderate, 2 low); not waived |
| Clean installed-package rollback to merged main | Final-source scoped fixture passes; not deployed rollback or full metadata rollback acceptance |

The first host PR run at `f36a6aa0...`
[failed](https://github.com/AbdullahZaher/vibress/actions/runs/42108180615):
2,754 tests passed, 11 inherited translation tests failed, and four new persistence
cases were skipped because their shared seeded-owner login failed. That fixture
was corrected to a dedicated synthetic account; all four pass locally. Its E2E
job had seven smoke passes, then 28 passes / nine media failures. These failures
are not hidden or relabeled as successful verification. Full build, migration
replay and container scan steps after the failed test gate were skipped.

Implementation-source [Studio CI 42205803530](https://github.com/AbdullahZaher/vibress-studio/actions/runs/42205803530)
and [documentation 42205803531](https://github.com/AbdullahZaher/vibress-studio/actions/runs/42205803531)
passed at `5da7066f...`; logs confirm 515/54, critical coverage and 256 browser
passes without skipped/retried cases. Final evidence-only HEAD checks are reported
on the PR. Host delivery HEAD `2a19d8f623b3943d5df43883e37f8f9d2e7e7426`
[workflow 42206116752](https://github.com/AbdullahZaher/vibress/actions/runs/42206116752)
passed typecheck, lint and production audit before entering the full test gate;
its final outcome must be inspected and is not declared green here. Both PRs had
zero submitted reviews and zero inline review threads at inspection; no human
approval was recorded.

## 6. UX evaluation and remaining study

No human user study or competitor task timing was performed. The requested 95%
completion target is **not established**. Automated tests are not satisfaction or
human completion-rate measurements.

| Representative task | Current evidence | Missing acceptance |
| --- | --- | --- |
| Create/format long article | Standalone formatting tests and long synthetic benchmarks | Whole author task with human timing/errors |
| Add gallery / replace image | Standalone mounted/component/browser coverage | Host media browser failures resolved; real asset permissions/durability |
| Add embed | URL/sanitization and standalone browser coverage | Host preview/published-provider task study |
| Move/delete blocks | Existing controls/keyboard coverage | Consistent nested-block human task evidence |
| Undo/redo | Studio browsers and host mounted selection/history regressions | Full collaborative restore/history workflow |
| Paste mixed Arabic/English | Automated mixed-script/RTL coverage | Physical IME, selection handles and copy/paste acceptance |
| Recover interrupted draft | Invalid-input recovery, A/B save ordering and local draft UI tests | Offline/crash/navigation reload durability through real host browser |
| Preview/publish | Round-trip/sanitized rendering and API persistence checks | End-to-end host publishing and affected translated/public content |

Study protocol still required: recruit representative Arabic/English authors,
run the same ten tasks against named versions of Vibress and Ghost, record task
success, elapsed time, errors and unexpected interactions, then collect
satisfaction ratings. Predefine success criteria and disclose participants,
assistance and exclusions. No invented completion percentage is reported here.

## 7. Arabic and accessibility

Automated: three desktop engines include existing keyboard, mixed-script, RTL,
mobile-emulation, focus and axe coverage. Two unit a11y tests pass. Host recovery
messages and blocked-restore explanations support explicit English/Arabic UI
locale independently of document direction, preserving current tokens and native
recovery details controls.

Manual: Android Gboard, iOS Arabic keyboard/selection, real soft-keyboard resizing,
VoiceOver, NVDA and TalkBack are **NOT VERIFIED**. Full localization beyond scoped
recovery/restore UI remains incomplete. Automated checks do not establish WCAG
2.2 AA conformance or certification.

## 8. Performance evidence

[Raw browser reports](data/editor-benchmark-2026-11-06.json) name clean source
`5da7066f...`, fixture hash, Chromium 151.0.7922.34, Apple M4 Pro (12 CPUs), macOS
arm64 and viewport. Each case records 20 actual key presses and verifies their
retained text. Desktop viewport is 1440×900; mobile emulation is 390×844 with 4×
CDP CPU throttling. This is a local Vite development harness with synthetic media,
not physical hardware or production network acceptance.

Mount ends at the second frame. Frame response is keydown-to-second-frame. The
separate synchronous commit measurement ends in a microtask after the complete
Lexical listener chain, including synchronous serialization regardless of
listener re-registration; it excludes later React work, paint and host saves.
Neither measure is INP. No before/after speedup is claimed.

| Scenario | Desktop mount ms | Desktop sync p95 ms | Desktop frame p95 ms | 4× mobile mount ms | 4× sync p95 ms | 4× frame p95 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| empty | 67.5 | 4.6 | 16.4 | 213.2 | 15.6 | 22.2 |
| 1000-words | 65.5 | 1.2 | 16.3 | 241.8 | 5.0 | 42.3 |
| 5000-words | 86.3 | 1.7 | 27.7 | 384.4 | 9.8 | 147.8 |
| 20000-words | 164.0 | 3.9 | 83.2 | 888.1 | 19.0 | 430.2 |
| 50000-words | 321.1 | 9.3 | 194.6 | 1369.6 | 55.9 | 912.5 |
| mixed-5000 | 124.2 | 1.9 | 52.6 | 536.6 | 9.3 | 261.6 |
| table-5000 | 191.7 | 7.0 | 114.7 | 819.7 | 64.1 | 598.7 |
| media-5000 | 167.5 | 45.1 | 52.4 | 745.1 | 185.9 | 223.6 |


The throttled media/table/50k synchronous cases exceed the proposed 50 ms budget;
the media case is particularly slow. They need profiling and remeasurement.
True INP ≤200 ms, memory-growth/leak acceptance, real mobile scrolling/paste and
production-host autosave performance remain unverified.

[CPU pipeline reports](data/document-pipeline-2026-11-06.json) separately measure
serialization, HTML rendering, Markdown export and HTML reimport over six
synthetic workloads, with seven iterations (three for reimport), one warmup,
medians/p95 and environment data. The 50k-word p95 values are 2.221 / 20.251 /
2.707 / 29.123 ms respectively. These are not browser responsiveness results.

## 9. Host integration and persistence

The four real persistence tests use authenticated Fastify APIs and disposable
PostgreSQL: save A, edit B while A is in flight, acknowledge A without marking B
saved, save B, exact GET reload, reject stale expectedVersion with 409; repeat for
posts/pages and historical-root/separate-record cases. Mounted PostEditor/
PageEditor tests separately exercise actual component request ownership with
mocked HTTP. This layered evidence is not one complete browser-to-server task.

The fourteen existing real collaboration cases cover multi-tenant permissions,
concurrency, reconnect and Redis persistence/restart boundaries. The new mounted
probe uses real Lexical/Y.Doc with an in-memory transport to prove why remount
alone cannot restore a retained room. Default UI gating contains that path;
coordinated REST restore, autosave across collaborative restoration, remote UI
cursors/card changes and durable reload acceptance remain blocked.

Future envelopes retain exact-input recovery. Nine immutable core fixture cases
pass with an explicit recovery-only future-version case. Renderer, host installed
types, nested card editors, permissions/media durability and production release
compatibility are not inferred from those fixtures.

## 10. Release gates and exact remaining backlog

| Gate / priority | State | Dependency and acceptance criterion |
| --- | --- | --- |
| Focused integrity corrections | Passed local + independent source review | Inspect final CI/reviews before human merge decision |
| Standalone strict package consumer | Passed locally, CI gate enabled | Supported clean Bundler/NodeNext imports stay strict; add independent browser-installed consumer |
| Host-wide CI / P1 | Blocked | Integrate separate host CI remediation without overwriting it; zero unexplained failed tests, media task failures or skipped release checks |
| Coordinated Yjs restore / P1 | Blocked, default UI gated | Host owner selects protocol; database+room+Redis+connected peers converge through restore, autosave and reload with no draft loss |
| Offline/crash/navigation persistence / P1 | Missing implementation/verification | Define recoverable local draft policy and run real browser A/B/save/fail/reload/document-switch matrix |
| Full host fixtures/renderers/media / P1 | Partial | Same historical fixtures across actual runtimes and published HTML; real durable assets, conflicts and permissions |
| Arabic/mobile and manual a11y / P1 | Pending | Real devices/keyboards and named screen readers; record each applicable WCAG criterion and unresolved issue |
| Author UX study / P1 | Pending | Product-approved protocol above, ≥95% success on defined core tasks without invented results |
| Heavy document performance / P1 | Budget misses | Profile measured synchronous/media/table paths; compare same fixtures/environment; meet scoped <50 ms p95 and collect true INP/memory/mobile evidence |
| Development advisories / P1 release review | Open, unaccepted | Security/tool owners remediate compatible pins or explicitly disposition each finding; no silent waiver |
| ADR-0001 architecture ownership | Proposed, approval pending | Authorized maintainers select canonical ownership and host/Yjs adoption; code does not approve ADR |
| Staging release and rollback | Not demonstrated | Package install/basic rollback is partial; rehearse full metadata/draft/media/CRDT preservation and recovery in staging |
| Observability/incident recovery | Pending host acceptance | Verify signals without content/secret logging, alerts, rollback triggers and incident recovery |
| Engineering/Product/QA/Security/Release approvals | Pending | Named authorized human approvals on exact release candidate |

[Audit data](data/dependency-audit-2026-11-06.json) distinguishes zero production
findings from the 25 development advisories. Development servers/tools must not
be treated as production-safe merely because packages are private. Disposition
remains OPEN; no organizational/manual gate was closed through a code change.

[The final prior-artifact consumer exercise](data/packed-consumer-rollback-2026-11-06.json) only checks its named v1/legacy-compatible
fixture. Older artifacts retain known metadata defects, so it cannot certify
rollback for arbitrary extended documents. Retain raw originals/current drafts
and compare complete envelopes/card data before any staging rollback acceptance.

## 11. Competitive assessment

This is a documentation-grounded comparison of criteria, not a head-to-head
usability or performance study, and no interface or implementation was copied.

| Reference interaction | Vibress evidence / remaining measurable gap |
| --- | --- |
| [Ghost cards](https://ghost.org/help/cards/): slash/plus insertion, media, captions and galleries | Standalone workflows have automated coverage; host media tasks and equal-task human timing remain open |
| [Gutenberg list view](https://wordpress.org/documentation/article/list-view/): nested block overview and management | Some block controls are tested; no demonstrated equivalent long-document navigation/task result |
| [Notion slash commands](https://www.notion.com/help/guides/using-slash-commands): inserting/modifying content from keyboard | Existing Vibress slash tests do not establish equivalent search ranking, discovery or completion time |
| [Tiptap collaboration](https://tiptap.dev/docs/collaboration/getting-started/overview): Yjs synchronization and version-related workflows | Host transport tests pass, standalone has no equivalent collaboration API, coordinated restore remains blocked |
| [Sanity Portable Text](https://www.sanity.io/docs/studio/portable-text-editor-configuration): configured styles/annotations/custom blocks | Studio has v1 structured documents and trusted plugins; cross-host contracts/manual editorial acceptance remain incomplete |

Arabic-first differentiation remains a product goal supported by some automated
RTL work, not a verified superiority claim against these products.

## 12. Independent quality scorecard

Independent read-only review examined the immutable implementation SHAs above,
reproduced additional defects and rechecked their corrections. It found no
remaining actionable correctness issue in the reviewed corrections. Wider gates
remain open. Scores are conservative reviewer judgments with limited confidence,
not measured usability outcomes or release authorization.

| Dimension | Weight | Score | Confidence |
| --- | ---: | ---: | --- |
| Content integrity/reliability | 25% | 7.6 | Medium |
| Writing/product experience | 20% | 7.6 | Low |
| Architecture/security | 20% | 8.2 | Medium |
| Arabic/RTL/accessibility | 15% | 6.2 | Low |
| Performance | 10% | 6.5 | Medium-low |
| Integration/release | 10% | 4.5 | Medium |
| Weighted total | 100% | **7.09 ≈ 7.1/10** | Provisional |

Calculation: 7.6×0.25 + 7.6×0.20 + 8.2×0.20 + 6.2×0.15 + 6.5×0.10 + 4.5×0.10.
The completed benchmark and final CI must be read alongside these judgments;
passing a test count cannot override a failed release gate.

## 13. GitHub delivery

- [Host PR #130](https://github.com/AbdullahZaher/vibress/pull/130): focused integrity implementation, four source commits plus evidence. No force push or shared-history rewrite.
- [Studio PR #34](https://github.com/AbdullahZaher/vibress-studio/pull/34): package contract, narrowly related integrity corrections, benchmark evidence and release-gate report.
- PR #33 was already merged; no duplicate of that PR was created.
- Both new PRs are drafts pending maintainer/CI acceptance. No human review approval is inferred from the independent agent's source assessment.
- Final workflow URLs/outcomes and exact delivery HEADs are reported with the PR metadata after verification. No merge, public package publication, production deployment or live-data migration occurred.

## 14. Final decision

**NOT READY FOR PRODUCTION.** The implemented changes materially improve
content integrity and package usability and are concrete, tested human-review
candidates. The full world-class program is not complete. The release gate
matrix names the exact remaining dependencies and acceptance criteria; it is not
a replacement for implementing the prioritized work already delivered here.
