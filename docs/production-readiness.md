# Vibress Studio — Release Readiness and Evidence Policy

**Last source review:** 2026-11-05  
**Current PR Branch:** `fix/stu-hardening-phases-a-f` (Target: [PR #28](https://github.com/AbdullahZaher/vibress-studio/pull/28))  
**Historical Audited Base SHA:** `bac22c542c31c5edcd96229de9d4cf47bcce0c42` (`main`)  
**Previous PR Review Commits:** `8deca49099ac030a1135dd29d101b4bc484aadb6`, `c90ce26c5e7d4847b1c657a522a1a3770ac91d65`, `b9d253374cdb526fbfd1deb21262e3a899f61db9`, `477fc9852be3f7cc8791d8c9b9974fff33789072`, `55f5c57007464090758ebd85c0c41031e7992c83`, `ce3693e94a8842ebfb9e53a0d2ba6957d32644d9`  
**Verdict:** **NOT CERTIFIED / RELEASE APPROVAL PENDING**.

This is the current readiness record. Historical reports describing the project as “production ready”, “fully secure”, “zero data loss” or “9.82/10 certified” are historical assertions, **not independently validated release evidence**. See the [source audit](audits/studio-source-reassessment-2026-11-04.md), the [current authoritative PRD & Engineering Execution Plan](roadmaps/product-quality-engineering-execution-plan-2026-11-05.md), and [remediation roadmap §16](roadmaps/global-ux-quality-roadmap.md#16-current-authoritative-remediation-and-development-plan--2026-11-04).

**Local recovery checkpoint, 2026-11-05:** See the [active-draft recovery report](audits/studio-draft-recovery-2026-11-05.md)
for a reproduced STU-205/STU-302 defect, its fix and current local verification.
The automated table below records earlier observations; neither it nor this
local checkpoint constitutes final-candidate CI or release sign-off.

> [!IMPORTANT]
> Green CI passes demonstrate automated regression checks on covered cases only; **they do not independently certify production-readiness or justify claiming target quality (9.2+/10)**. The 12-week Product Quality & Engineering Execution Plan is currently active in Phase 1 execution, and is not completed.

## Automated Verification Baseline

The following automated validation suite is required on every release candidate:

| Command | Status / Observed Baseline | Details |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | **PASS** | Clean dependency tree on Node 24 and pnpm 11.17 |
| `pnpm lint` | **PASS** | 0 ESLint errors; legacy warnings preserved |
| `pnpm verify:explicit-any` | **PASS** | **0** `explicit-any` instances in production scan (scripts/count-explicit-any.mjs) |
| `pnpm -r build` | **PASS** | Clean build across all 13 workspace packages + playground Vite bundle |
| `pnpm -r typecheck` | **PASS** | Zero TypeScript compiler diagnostics |
| `pnpm test` | **PASS** | **30 test files, 242+ unit tests** passing via Vitest |
| `pnpm test:security` | **PASS** | 9 security tests passing (Markdown, URL, HTML sanitization, roundtrip) |
| `pnpm test:a11y` | **PASS** | 2 semantic accessibility tests passing |
| `pnpm test:roundtrip` | **PASS** | HTML/Markdown roundtrip integrity verified |
| `node scripts/verify-package-exports.mjs` | **PASS** | Validated export maps across 13 packages |
| `pnpm test:e2e` | **PASS** | **78/78 Playwright scenarios passed** (Chromium & Lighthouse AA) |
| `pnpm audit --prod` | **PASS** | No known vulnerabilities found |

Passing tests demonstrate their *covered cases only*. They do **not** certify absence of security bugs, content loss, or compatibility defects.

## Remediation Roadmap Gates & Status

| Gate | Status | Verified Evidence |
| --- | --- | --- |
| G0 — Canonical runtime ownership | **Proposed** | ADR-0001 drafted; pending repository owner formal sign-off. Vibress host remains production runtime reference. |
| G1 — Document integrity & media concurrency | **Reopened — pending host and gallery acceptance** | Historical migration/upload regressions exist, but F01 host autosave ordering and F02 additive gallery selection require passing updated tests on the final commits. |
| G2 — Fidelity, security & controls | **Partially verified** | Existing sanitizer, Markdown, renderer, and plugin tests cover historical regressions. New resource-limit and embed parity changes require CI and adversarial review; host security remains independent. |
| G3 — RTL, mobile & accessibility | **Automated baseline only** | Chromium viewport/RTL regressions exist. The updated heading-link test still needs final CI confirmation; WCAG 2.2 AA, real mobile Arabic IME, VoiceOver, NVDA, and TalkBack are not manually verified. |
| G4 — Performance & package contracts | **Partially verified** | Package export and word-count implementation checks exist. Historical microbenchmarks are not production latency evidence; representative INP, p95 typing, memory, clean external consumer installation, and rollback remain unverified. |
| G5 — Independent acceptance & release sign-off | **Pending Sign-Off** | All automated suites pass; requires human engineering review, ADR-0001 alignment, and formal sign-off before release or tag publication. |

## Rules for changing this verdict

1. Triaged P0 risks are fixed or explicitly disproved with tests. Do not conflate *potential* risks with reproduced incidents.
2. The full current verification sequence documented in `AGENT.md` §15 passes on the release commit; record exact commands and outcomes. CI audit uses `--audit-level high`, which is not the same as a blanket zero-advisory claim.
3. Hosts remain responsible for permissions, persistence/autosave, revision conflict handling, durable uploads and AI authorization. Studio's library must not acquire these services.
4. Reviewers verify actual desktop/mobile/light/dark/RTL/LTR/mixed-script behavior, focus and screen-reader flows, and published rendering.
5. ADR-0001 is resolved by explicit owner approval, including a tested named-host-SHA compatibility contract.
6. Only an independent, dated evidence package may support a numeric quality rating or a release-ready statement. A completed CI run by itself is insufficient.

## Not verified in this documentation pass

- **Not verified:** real-device Arabic/mixed-direction and accessibility conformance. **How to verify:** execute roadmap §16.4 and record screenshots, keyboard and VoiceOver/TalkBack sessions.
- **Not verified:** host-standalone parity or host persistence behavior. **How to verify:** complete roadmap §16.5 against the named current Vibress host commit.
- **Not verified:** Yjs CRDT real-time collaborative editing interoperability.

**No repository release, package publication or deployment is authorized by this document.**

## 2026-11-05 remediation evidence in progress

- The baseline PR #28 HEAD assessed before these changes was `36445d0288bed112e84944b838bea7373589d5bc`. Only a passing workflow on the **new final HEAD** counts as updated test evidence.
- F01 host-only work is in [Vibress PR #124](https://github.com/AbdullahZaher/vibress/pull/124). The active host remains a separate runtime; no parity or Yjs interoperability is asserted.
- F02 gallery addition, F03 shared admission limits, F04 accessible heading permalinks, F05 embed parity, and F08 transforms contract changes are in standalone PR #28 awaiting final CI and review.
- F07 manual WCAG 2.2 AA checks, F10 external package installation and rollback, and F11 measured editor performance remain independent release gates. No numerical quality improvement or production certification follows from patches alone.
