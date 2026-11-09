# G0–G5 Beta Release Evidence Correction — 2026-11-09

**Document type:** Independent-source cross-check / release-claim qualification. **Not a new security certification, formal release approval, or tag change.**

## Exact release baselines (verified in GitHub)

| Repository | Main and release tag target | CI at that SHA |
| --- | --- | --- |
| [Vibress Studio](https://github.com/AbdullahZaher/vibress-studio) | `f13bdf1e049434c71da74572f4e226457fdb6393`, existing annotated tag `v1.2.0-beta.2` | [CI #42522465244](https://github.com/AbdullahZaher/vibress-studio/actions/runs/42522465244) — success; 562/562 unit, 256/256 editor browser E2E; prod dependency audit reports no known vulnerabilities |
| [Vibress CMS](https://github.com/AbdullahZaher/vibress) | `3344f83f30dd23205abb596f4320857f4611812a`, existing annotated tag `v1.2.0-beta.1` | [CI #42515269430](https://github.com/AbdullahZaher/vibress/actions/runs/42515269430) — success |

Both tags were already present before this correction. Do not recreate, force-update, delete, re-tag or deploy either tag as part of evidence maintenance.

The Studio CI job [at the precise release SHA](https://github.com/AbdullahZaher/vibress-studio/actions/runs/42522465244) contains build, lint, explicit-any, typecheck, tests, production audit, packed consumer Bundler/NodeNext checks, document pipeline benchmark and nine cross-repository **persisted core fixtures**. The corresponding CI log labels that fixture verification `Persisted core fixtures only; no renderer/editor/Yjs/service parity asserted`. The 256 normal Playwright E2E tests do not by themselves constitute manual WCAG 2.2 AA or physical-device acceptance.

## Gate claims: recorded milestone vs independently demonstrated scope

| Gate | Demonstrated evidence | What must **not** be inferred |
| --- | --- | --- |
| G0 — repository/build | Clean CI at named release SHAs; Studio 562 unit and 256 E2E successful | A green CI is not independent production sign-off |
| G1 — package contracts | Studio clean packed consumer checks in Bundler and NodeNext with ESM/CJS/CSS exports | This is not a repository-wide third-party license legal opinion; verify license inventory separately if required |
| G2 — dependency/security | Merged Studio [#39](https://github.com/AbdullahZaher/vibress-studio/pull/39) and CMS [#146](https://github.com/AbdullahZaher/vibress/pull/146); 0 known production audit findings in recorded CI; ADR-0001 records approved Option B | A `--prod` audit does not close full dev advisories; remaining `vite@5.4.21`, `zod@3.25.76` (Studio), `nx@23.1.1` (CMS) have separately documented dev risk dispositions, not proof of zero risk. No independent `APPROVED` PR reviews were found for those merged PRs in the inspected GitHub review records |
| G3 — accessibility & Arabic IME | Merged Studio [#40](https://github.com/AbdullahZaher/vibress-studio/pull/40); keyboard/ARIA/IME tests and normal browser E2E green | Automated checks do not establish **full WCAG 2.2 AA conformance** or native VoiceOver, TalkBack, NVDA, iOS/Android IME coverage; request manual device/screen-reader evidence |
| G4 — performance | Merged Studio [#41](https://github.com/AbdullahZaher/vibress-studio/pull/41), 32 **reported local benchmark** scenarios, documented measured timing proxies | This is not field Core Web Vitals INP p75 certification; existing tables contradict blanket 50 ms desktop / 85 ms mobile, 5.5 ms commit, 45 ms slash and 85 ms mount claims. The browser performance suite is not currently run by final Studio CI. See [performance validation](../performance-validation.md) |
| G5 — host compatibility | Merged Studio [#42](https://github.com/AbdullahZaher/vibress-studio/pull/42); nine v1 core fixture checks against immutable host SHA in final Studio CI, independent package consumer checks, and separate CMS-side Yjs regression tests | **Not full host/standalone Lexical/editor/Yjs runtime parity**, nor a demonstrated live production host rollback/replacement. Host remains authoritative under approved ADR-0001. See [compatibility evidence](../compatibility/host-runtime-parity-2026-11-05.md) |

## Specific reproducible G4 contradictions

These are values **as reported by the project's own historical tables**, not newly rerun measurements. On Desktop Chromium, 5k-word tables record typing proxy p95 **74.8 ms** and mount **122.9 ms** (both exceed blanket 50 ms and 85 ms desktop targets); 5k media cards record synchronous commit proxy **28.7 ms** (exceeds 5.5 ms). On desktop Firefox, 5k media cards record typing p95 **69 ms**. On Chromium mobile emulation under 4× CPU throttling, mixed Arabic 5k, table 5k, and media 5k typing proxies are **148.1, 293.7, 143.2 ms** (each exceeds 85 ms). On mobile media 5k the commit proxy is **122.9 ms**, beyond a blanket 40 ms claim.

The `e2e/performance/editor-benchmark.spec.ts` test uses `keydown` to the second animation frame, optional Event Timing API samples, a synthetic paste event plus fixed 50 ms wait, and short heap/DOM snapshots. It explicitly labels its typing and commit measures `Not INP`. The observations are useful diagnostic baselines but cannot prove INP p75, zero memory leaks, or actual physical-device responsiveness.

## Formal architecture and sign-off boundaries

[ADR-0001](../adr/0001-studio-canonical-runtime.md) **is marked Approved (Option B)** and identifies sign-off roles. It selects the CMS as host runtime reference and Studio as the downstream distribution target; it explicitly says the decision does **not approve shipping** or assume host feature parity. The merged PR review records inspected for Studio #39–#42 and CMS #146 did not include independently submitted `APPROVED` review entries. This does not disprove sign-offs documented elsewhere; it means the review record alone cannot establish the claimed independent approval identity.

## Missing evidence to obtain before broader public claims

1. An independently signed G3 manual matrix covering NVDA/VoiceOver/TalkBack, keyboard, RTL/mixed Arabic IME, iOS Safari/Android Chrome, contrast, zoom and touch targets. Record devices, OS/browser, versions, and final commit SHA.
2. A reproduced 32-case G4 browser benchmark on the **final SHA** with raw JSON artifacts, budgets per document class, accurate typing-vs-INP terminology and a separate valid field INP assessment.
3. G5 integration evidence for actual host/standalone editor interoperability if this is ever required; test active two-client Yjs sessions and host persistence/rollback against named SHAs, rather than treating fixture tests as editor parity.
4. G2 independent full dev-audit disposition, and a verified media storage cutover/rollback procedure including late legacy files. A claimed local count of **448 assets migrated** is not independently established by Studio or CMS release CI alone.
5. Document exact identities/dates and scope of independent human sign-off and package license review where relevant.

## Reporting decision

**Verified:** Two already-created beta tags at their immutable intended SHAs, and green mainline CI at those SHAs. **Not established by the inspected evidence:** universal G0–G5 independent sign-off, blanket accessibility/performance SLAs, true INP, zero memory leaks, cross-editor Yjs drop-in parity, or a live production rollback.

Keep the release tags intact. This evidence correction should go through a separate PR and does not retroactively modify, revoke, or self-certify the tagged binaries. Any release/go-live decision remains with maintainers and independent reviewers.
