# Host/Standalone Studio Compatibility Evidence — 2026-11-05

**Status: Historical source comparison + 2026-11-08 G5 evidence addendum; NOT proof of drop-in host editor replacement.**
ADR-0001 is **Approved (Option B: host runtime canonical, standalone downstream)**. This approval defines ownership; it does **not** approve dropping standalone Lexical into the CMS or demonstrate Yjs runtime parity. The older matrix below remains a historical comparison at its named commits.

Program follow-up (2026-11-06): host candidate `cb0be3f03460cc57143e43db093c523e27b4cf0d`
([PR #130](https://github.com/AbdullahZaher/vibress/pull/130)) now passes all nine
immutable persisted/recovery fixture cases. One case is explicitly recovery-only:
future envelopes validate losslessly but host editor migration refuses them with
exact original input. This is an intended admission difference, not full runtime
parity. Standalone strict Bundler and NodeNext consumers pass with the evaluated
0.14.3 engine family; the host dependency graph is unchanged. Real host API/
PostgreSQL persistence (4) and existing WebSocket/Yjs tests (14) pass in disposable
services. Full host browser publishing, live-device acceptance and owner approvals
remain open. The matrix below is a **historical** comparison at its named commits.

See the [current verified delivery report](../audits/world-class-editor-program-2026-11-06.md) for the findings, final-source evidence and release blockers.

## Named immutable references

- Standalone assessment baseline: `AbdullahZaher/vibress-studio@36445d0288bed112e84944b838bea7373589d5bc` (PR #28).
- Vibress production-reference baseline: `AbdullahZaher/vibress@b33fb1ab597bfabb8861516132cf8bad567f0bf1`.
- Active host-specific remediation: [Vibress PR #124](https://github.com/AbdullahZaher/vibress/pull/124) (unmerged, pending CI/review).
- Standalone hardening: [Studio PR #28](https://github.com/AbdullahZaher/vibress-studio/pull/28) (unmerged).
- Re-run the matrix on the final candidate HEADs before any extraction.

## Capability/API parity matrix

| Capability | Host reference | Standalone reference | Evidence/gate |
| --- | --- | --- | --- |
| Document envelope | `vibress-studio` v1 | `vibress-studio` v1 | Source verified; cross-repository old fixtures not executed |
| Legacy `react-studio-card` | Supported | Normalization supported | Source verified; bidirectional fixtures pending |
| `@vibress/studio-react` package version | 1.2.0 | 0.1.0, private | Package metadata verified |
| React/ReactDOM | 18.3.1 | 18.3.1 | Metadata verified |
| `lexical` | 0.13.1 | 0.13.1 | Metadata verified |
| `@lexical/history`, `@lexical/utils` | 0.52.0 | 0.13.1 | **Blocked** pending real runtime compatibility testing; do not blanket upgrade |
| `@lexical/yjs` and Yjs providers | Host WebSocket/memory collaboration | No standalone collaboration API | **Not Verified** interoperable; no substitution |
| External document replacements | Host `InitialStatePlugin` with different behavior | `DocumentSyncPlugin` + `replacementId`; `revisionId` informational | **Not equivalent**, requires deliberate integration changes |
| Persistence/autosave | Host PostEditor/PageEditor with `expectedVersion` | Host callback boundary only | Host PR #124; no full durability certification |
| Media picking/upload | Host durable media API integration | `requestMedia`/`uploadMedia` callbacks | Mock tested; host permissions and URL durability need end-to-end tests |
| AI | Host callback + gateway | Opt-in callback interface | Host authorization and consent remain host-owned |
| Public HTML/cards | Host packages | Server-safe renderer/card definitions | **Partially Verified**; compare exact fixtures and output before sync |
| CSS and accessibility | Host theme/Tailwind integration | Scoped Studio CSS/tokens | Full parity and screen reader behavior not verified |
| Package distribution | Internal workspace/private | Internal workspace/private | No clean independent consumer/rollback demonstration |

## Mandatory executable gates before host runtime replacement

1. Pin a specific final source SHA for each repository; compare package metadata, public exports, CSS and node registrations without private imports.
2. Load *the same* historical v1 documents (legacy cards, captions, nested tables, marks, Arabic bidi) into both runtime builds. Compare normalized data and safe public HTML; fail any unexplained content loss.
3. Execute two active host Yjs sessions with concurrent local/remote edits, network disconnect/reconnect, cold page reload, and revision restoration; verify durable persistence and undo semantics.
4. Fault-inject delayed/out-of-order HTTP acknowledgments, HTTP 409, failed uploads, and interrupted navigation in both PostEditor and PageEditor using actual host APIs.
5. Test host permissions for upload/publish/AI operations and ensure no temporary `blob:` URLs reach persistence.
6. Verify package consumers, production logging, performance budgets, rollback, and manual RTL/accessibility acceptance.

Until all applicable gates and owner approvals are recorded, classify integration as **BLOCKED** for replacement. The existence of host collaboration code is not proof of compatibility with standalone Studio.

## 2026-11-08 Gate G5 Verification Checkpoint (Persisted Format & Host-Owned Collaboration)

### 1. Verified Commit Baseline
- **Vibress Host Baseline:** `AbdullahZaher/vibress@3344f83f30dd23205abb596f4320857f4611812a` (Tag: `v1.2.0-beta.1`).
- **Standalone Studio Baseline:** `AbdullahZaher/vibress-studio@f882d4a55ba85fb729b2f18c341212a5b1e31f24`.

### 2. Cross-Repository Persisted Fixture Verification
Verified via `node scripts/verify-host-compatibility.mjs --host /path/to/vibress --ref 3344f83f30dd23205abb596f4320857f4611812a`:
- `current-mixed-rtl`: **PASS** — Complete bidirectional text and Tashkeel normalization equivalence.
- `legacy-card`: **PASS** — Legacy card structures parse and normalize equivalently.
- `unknown-future-node`: **PASS** — Preserved safely without corruption.
- `future-document-version`: **PASS** (Recovery-only admission boundary) — Persisted envelope preserved losslessly; host editor migration refuses editing with exact original input.
- `tables-lists-code`: **PASS** — Complex table cells, lists, and code blocks round-trip identically.
- `envelope-extension`: **PASS** — Metadata extensions parsed safely.
- `foreign-schema`, `invalid-root`, `unknown-object`: **PASS** — Malformed or invalid envelopes rejected safely.

### 3. Host Dependency Graph & Collaboration Parity
- **Dependency Evaluation:** Host monorepo (`vibress`) retains its validated dependency configuration (`lexical@0.13.1` with `@lexical/yjs@0.52.0`, `@lexical/history@0.52.0`, `@lexical/utils@0.52.0`, and `yjs@13.6.32`).
- **Executable Host Test Verification:**
  - `packages/studio-react/src/__tests__/crdt-collaboration.test.ts` (3/3 passed): Deterministic synchronization across two independent clients, offline edits sync upon reconnection without data loss, presence/awareness propagation.
  - `packages/studio-react/src/__tests__/collaborative-restore-boundary.test.tsx` (1/1 passed): Retained collaborative root correctly fences over remounted database restores.
  - `tests/integration/studio-collaboration-production.test.ts` (17/17 passed): Multi-tenant room isolation, cross-publication blocking (403), Redis CRDT persistence and restart recovery, oversized update rejection (>64 KB), rate-limiting, and epoch increment fencing.
  - `tests/integration/collaboration-epoch-security.test.ts` (17/17 passed): Stale Yjs replay rejection (4409), monotonic epoch fencing, offline partition healing without document corruption.
- **Architectural Policy Reaffirmed:** ADR-0001 Option B remains authoritative. The host monorepo retains ownership of active runtime collaboration and autosave persistence; standalone Studio serves as a downstream distribution target.
- **Scope limit:** The 38 host CRDT/collaboration tests run in the **CMS host implementation**. They do **not** run the standalone editor with the host Yjs provider or prove the two editors can replace each other. The Studio CI compatibility script explicitly reports `Persisted core fixtures only; no renderer/editor/Yjs/service parity asserted`.

### 4. Independent Package Consumer & Reversible Rollback
Verified via `node scripts/verify-packed-consumer.mjs`:
- **Clean Installation:** 13 packages built, packed into `.tgz` tarballs, and installed in an independent React 18.3 / TS consumer without workspace links.
- **TypeScript Resolution:** Passed with both `Bundler` and strict `NodeNext` resolution modes.
- **Exports & Assets:** ESM and CommonJS exports, `@vibress/studio-react/styles.css` and `tokens.css` verified.
- **Reported local rollback check:** The program report describes a `--baseline-ref v1.2.0-beta.1` packed-consumer rollback check. The normal final Studio CI checks clean Bundler/NodeNext consumer installs and persisted fixtures, **not** a production host database/provider downgrade or a live two-client rollback drill. Preserve the original local artifact before claiming those broader scenarios.

### Release-claim boundary (2026-11-09)

The original historical matrix contains stale unmerged-PR and old Lexical version references; read it only with its dated SHAs. **Current release-level evidence establishes persisted v1 fixture compatibility, host-only Yjs regression coverage, and packaged consumer smoke tests.** End-to-end migration from the standalone editor into live CMS collaborative sessions, actual host autosave conflict behavior under version swaps, and live rollback remain separate acceptance tasks. See [release evidence correction](../audits/release-evidence-correction-2026-11-09.md).

---

## References

- [Host React package](https://github.com/AbdullahZaher/vibress/blob/b33fb1ab597bfabb8861516132cf8bad567f0bf1/packages/studio-react/package.json)
- [Standalone React package](https://github.com/AbdullahZaher/vibress-studio/blob/36445d0288bed112e84944b838bea7373589d5bc/packages/studio-react/package.json)
- [Host React editor](https://github.com/AbdullahZaher/vibress/blob/b33fb1ab597bfabb8861516132cf8bad567f0bf1/packages/studio-react/src/VibressStudio.tsx)
- [Standalone React editor](https://github.com/AbdullahZaher/vibress-studio/blob/36445d0288bed112e84944b838bea7373589d5bc/packages/studio-react/src/VibressStudio.tsx)
- [Host PostEditor](https://github.com/AbdullahZaher/vibress/blob/b33fb1ab597bfabb8861516132cf8bad567f0bf1/apps/admin/src/components/PostEditor.tsx)
- [Host PageEditor](https://github.com/AbdullahZaher/vibress/blob/b33fb1ab597bfabb8861516132cf8bad567f0bf1/apps/admin/src/components/PageEditor.tsx)
- [ADR-0001](../adr/0001-studio-canonical-runtime.md)
