# PR #33 final review remediation — 2026-11-05

## 1. Executive summary

Lead role: document/data integrity engineering, with React/Lexical integration and QA verification.

The latest PR HEAD was verified before modification as
`54de2142ca2fc111181098675f7dcc09a2221fd3`, matching the local branch.
All three reported defects were independently reproduced before their fixes.
CR-01 failed six of seven initial mounted tests; CR-02 failed the new mounted
gallery identity test; CR-03 failed eight mounted cases across image, video,
audio and file cards. The corrected targeted suite passes 81 tests in five files.

The previously requested historical-root correction is included: only unambiguous
v1 roots missing their discriminator are repaired. Ambiguous data stays in typed
recovery with its original input; repaired documents are checked against limits.
No persisted schema/version changes, dependency upgrades or host runtime copies
were introduced.

## 2. Root cause and implementation

### CR-01 — ordered envelope acknowledgment

- **Reproduction:** mount status `old`, acknowledge status `new` with an identical
  root, then edit locally. Previously the emitted envelope still said `old`.
- **Root cause / file / function:** `DocumentSyncPlugin` in
  `packages/studio-react/src/VibressStudio.tsx` returned on root equality before
  updating `acceptedDocumentRef`, the source for outgoing serialization.
- **Correction:** additive optional `metadataRevision` authorizes only the
  envelope. It is a strictly increasing non-negative safe integer within one
  `replacementId` epoch. An older/equal/omitted sequence cannot regress metadata;
  a metadata acknowledgment never installs its possibly stale root, resets dirty
  tracking/history/selection, or emits `onChange`. Invalid input does not consume
  authorization. Only explicit replacement starts a new document epoch.
- **Host contract:** sequences belong to authoritative snapshots, not response
  arrival order. The host rejects responses from another document epoch and sends
  the complete envelope including unknown fields. Root equality and `revisionId`
  cannot establish authority. Unsequenced identical-root metadata remains ignored
  because it is ambiguous; existing hosts must opt in to acknowledge metadata.
- **Regression:** `external-metadata-ordering.test.tsx` (7 tests), plus existing
  stale-echo/recovery tests. Covers identical/stale roots, ordering, later local
  edits, revision labels, replacement, unknown fields, invalid schema/resource
  recovery, selection, undo/redo and absence of acknowledgment emissions.
- **Compatibility:** existing props retain their roles; the new prop is optional
  and does not alter persisted Studio v1.

### CR-02 — consistent gallery append identity

- **Reproduction:** an existing URL under `asset-1` was inserted again when the
  picker returned the same URL under another ID. An ID-only key hid URL equality.
- **File / function:** `GalleryCardEditor.tsx`; identity is extracted into
  `utils/appendGalleryImages.ts` and used by both picker and upload additions.
- **Correction:** either a non-empty durable asset ID or an exact trimmed URL
  identifies an already inserted item. Query strings remain significant;
  filenames are never identities. Only additions are filtered; existing entries,
  repetitions, order and metadata are retained. Picker append has no
  intentional-repeat command; persisted authored repetitions remain supported.
- **Regression:** five identity unit cases and five actual Gallery/Lexical tests
  cover ID/URL aliases, duplicate selections, query strings, legacy records,
  preserved metadata/order, concurrent/delayed additions, deletion, cancellation,
  save/reload and undo/redo.
- **Compatibility:** no gallery schema or existing image removal; append does not
  refresh a matching asset's URL or overwrite its existing alt/caption metadata.

### CR-03 — request and upload busy ownership

- **Reproduction:** start an upload in an empty card, populate the same pending
  card (an undo/integration race), then select/cancel from its actual library
  toolbar. The obsolete upload was correctly ignored, but returning to the empty
  state exposed a permanently disabled upload control in all four media cards.
- **Root cause / file / function:** `useMediaRequestGuard` only authorized result
  application; each card's `finally` cleared busy state only for a current token.
  A superseding picker invalidated that token without owning/clearing busy state.
- **Correction:** the shared guard tracks independent upload leases. Replacement
  requests revoke previous leases immediately. Each completion can release only
  its own lease; obsolete completion cannot clear a newer upload. Gallery
  additions retain independent additive leases. Shared `useCardMediaPicker`
  handles synchronous throws, rejected promises and invalid URLs with retry UI
  through `MediaPickerError`, preserving current metadata/durable references.
- **Files:** guard and picker helpers, plus Image/Video/Audio/File/Gallery editors.
- **Regression:** 62 actual mounted media cases and two guard cases cover library
  selection/cancel/sync and async failures, invalid URLs, retry, both upload
  completion orders, stale overwrite/busy protection, deletion/unmount, gallery
  partial success/retry, additive concurrency and current author metadata.
- **Compatibility:** callback signatures are unchanged; `null` still cancels.
  Network cancellation and unused durable-upload cleanup remain host-owned.

## 3. Verification matrix

Local commands ran on Node 24.16.0 / pnpm 11.17.0, macOS arm64. No tests or
thresholds were weakened and no timeouts increased. CI links and the final pushed
SHA are recorded in PR #33 after the final push.

| Command | Actual result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass; lockfile unchanged |
| `pnpm lint` | Pass; 0 errors, 9 existing warnings |
| `pnpm verify:explicit-any` | Pass; production explicit-any count 0 |
| `pnpm build` | Pass; 13 packages and playground |
| `pnpm typecheck` | Pass; workspace packages/playground |
| `pnpm test` | 499 passed / 51 files; no skips |
| `pnpm test:coverage` | 499 passed; aggregate branches 93.56% |
| Critical-file branch gates | Core 96.72%, editable schemas 92.85%, serializer 90%, sanitizer 91.63%; each required gate >=90% |
| New targeted regression run | 81 passed / 5 files; no skips |
| `pnpm test:security` | 22 passed / 5 files |
| `pnpm test:a11y` | 2 passed / 1 file; semantic checks only |
| `pnpm test:roundtrip` | 29 passed / 2 files |
| `pnpm verify:package-exports` | Pass / 13 packages |
| `pnpm verify:consumer-imports` | Pass / ESM, CJS, SSR and CSS exports |
| `pnpm verify:packed-consumer --runtime-only --baseline-ref b86c8e66f1e615eed756b4335de4950b29114181` | Pass / 13 clean tarballs and previous-package reinstall/reopen/save rollback; types explicitly not checked |
| `pnpm verify:packed-consumer` | **Fail** / Lexical declarations TS7016 and TS2677 (Bundler resolution) |
| `pnpm verify:packed-consumer --strict-nodenext` | **Fail** / same upstream declaration incompatibilities |
| `pnpm benchmark:document` | Pass / CPU document pipeline; not browser INP or physical-device latency |
| `node --test scripts/compare-editor-benchmarks.node-test.mjs` | 3 passed, 0 skipped |
| `pnpm docs:build` | Pass |
| `pnpm test:e2e` | 256 passed across Chromium/Firefox/WebKit (3.1m), 0 retries/skips; Lighthouse is intentionally Chromium-only |
| `pnpm audit --prod` | Pass / no known advisories |
| `pnpm audit --json` | 25 development-tool advisories: 7 high, 16 moderate, 2 low |
| Immutable host fixture comparison | **Blocked** / 7 pass, 2 differ at host `05446c782ab37db60d4cf6082184c2233934c2bc` |

The host verifier originally failed to resolve a new host-relative import.
It now reads the entire core source tree at the specified immutable commit,
instead of potentially mixing host and standalone files. The remaining two real
fixture differences are future document versions and envelope extensions.

## 4. Source compatibility

Canonical Studio v1 and strict persisted validation remain intact. Editable
admission still rejects unsupported/future nodes without silently saving their
lossy Lexical projection. Recovery retains original input and the active draft.
Unknown envelope/editor metadata, legacy cards, HTML sanitization, context-specific
URLs, plugin validation/sanitized output, media durability, mixed Arabic/English,
HTML/Markdown round-trips and history paths are covered by the executed suites.

`metadataRevision` is the only additive host prop. `replacementId` remains the
explicit replacement command and `revisionId` remains informational. No automatic
host synchronization, Yjs parity, schema approval, package publication or
production deployment is implied.

## 5. Remaining risks

- ADR-0001 is **Proposed**, with named decision owners/approval still required.
- The immutable host comparison has two differences; neither has been waived.
  Production historical content and service parity are not certified by fixtures.
- Strict installed Lexical 0.13 declarations fail in both supported consumer
  resolution probes; no `skipLibCheck` suppression or speculative upgrade was made.
- Not verified: real host autosave/conflicts, Yjs and persistence integration.
  How to verify: run approved host integration tests and exercise delayed and
  cross-document acknowledgments using the documented ordering contract.
- Not verified: physical devices, IME, screen readers and manual accessibility.
  How to verify: complete the named manual release checklist on real hardware.
- Production audit is clean; 25 development-tool advisories remain. They require
  explicit dependency mitigation/acceptance, not a production-audit waiver.
- Existing optional esbuild/Vite peer mismatch and playground chunk-size warning
  remain. No broad toolchain update was introduced.
- Runtime package reinstall rollback passed only for the synthetic v1/legacy
  consumer fixture. Not verified: deployed-host release/rollback, storage restore,
  CDN behavior or publication permissions. How to verify: approved staging release
  and rollback drills with the actual host, persistence and asset infrastructure.
- Performance budgets, physical-device INP/memory and production monitoring
  acceptance remain open; a successful CPU benchmark is not their substitute.

## 6. Pull request status

Existing PR: <https://github.com/AbdullahZaher/vibress-studio/pull/33>.
Branch: `codex/studio-production-readiness-program`.
The PR remains draft/unmerged. GitHub reported no submitted reviews or review
threads during the initial audit. The final SHA, Actions run links and final review
snapshot are recorded in the PR description and engineering handoff after push.
No duplicate PR, merge, force-push, package publication or deployment was performed.

## 7. Final decision

**CHANGES REQUIRED** for release approval. CR-01/02/03 are reproduced and corrected,
but installed declaration failures, host fixture differences and organizational /
manual release gates remain open. The remediation is ready for independent code
review; it is not a claim of production readiness.
