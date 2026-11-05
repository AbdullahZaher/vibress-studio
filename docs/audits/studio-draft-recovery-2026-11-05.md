# Active-draft recovery regression — 2026-11-05

## Scope and references

This is a local implementation/evidence checkpoint for **STU-205 and STU-302**
in the [quality execution plan](../roadmaps/product-quality-engineering-execution-plan-2026-11-05.md).
It addresses one confirmed defect; neither ticket nor release gate is certified
complete by this report. Lead role: document integrity/editor engineering.

- Standalone starting commit: `619f23281a748969735dae062a25457ca0b3e519`.
- Working branch: `codex/studio-recovery-preserve-draft`; results apply to its
  local working changes, not a remote CI run or released artifact.
- Host reference inspected: `b33fb1ab597bfabb8861516132cf8bad567f0bf1`.
  No host runtime changes or host compatibility tests were performed.
- Runtime: macOS, Node `24.16.0`, pnpm `11.17.0`; installed workspace dependencies.
- Baseline before implementation: `pnpm test` passed **36 files / 288 tests**.

## Confirmed defect and acceptance

After a successful load and local editing, an invalid, unsupported or oversized
incoming `value` took the initial-load error branch. React unmounted the active
Lexical editor. Its local draft, selection, undo stack and pending card editors
could therefore be discarded when the host next supplied valid input.

Four new component cases were run against the unchanged implementation and
**failed**: all three incoming error categories caused an editor cleanup, and
the invalid replacement-token case lost its mounted editor. Command:

```sh
pnpm exec vitest run packages/studio-react/src/__tests__/external-recovery-draft.test.tsx
```

The implementation retains the editor after a successful document load, displays
an accessible alert, makes editing read-only and suppresses outgoing snapshots
while input recovery is required. The synchronization plugin stays mounted and
does not consume rejected replacement tokens. Initially invalid input still
opens the existing recovery screen without initializing an editor.

Six component cases now verify:

- Invalid envelopes, unsupported nodes and resource-limit errors retain the
  editor instance and draft; the error retains the rejected raw input.
- Asynchronous Lexical updates during recovery remain local. A valid stale echo
  resumes the same draft; subsequent edits can emit snapshots again.
- A valid retry can use the replacement token from its rejected attempt.
- Selection and undo history survive recovery.
- An explicitly read-only host remains read-only after recovery.

The added browser journey verifies that the same contenteditable DOM element
stays connected, the mixed Arabic/English draft remains visible while paused,
the last valid host snapshot is retained, and typing/snapshot emission resume
after valid input. It captures `paused-draft.png` in its Playwright output
directory; the screenshot was visually inspected.

## Verification results

| Command | Local result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Pass; already up to date |
| `pnpm build` | Pass across workspace packages and playground |
| `pnpm lint` | Pass; 0 errors, 9 existing warnings |
| `pnpm verify:explicit-any` | Pass; production scan count 0, configured maximum 50 |
| `pnpm typecheck` | Pass across workspace packages and playground |
| `pnpm test` | Pass; **37 files / 294 tests** |
| `pnpm verify:package-exports` | Pass; 13 packages |
| `pnpm verify:consumer-imports` | Pass; workspace ESM/CJS, server rendering and CSS export smoke checks |
| `pnpm test:security` | Pass; 3 files / 9 tests |
| `pnpm test:a11y` | Pass; 1 file / 2 tests |
| `pnpm test:roundtrip` | Pass; 1 file / 1 test |
| `pnpm test:e2e` | Pass; **79 Chromium scenarios**, including Lighthouse and recovery |
| `pnpm audit --prod` | Pass; no known vulnerabilities reported at execution time |
| `pnpm docs:build` | Pass; VitePress site builds and renders |
| `pnpm exec vitest run tests/docs-drift.test.ts` | Pass after documentation edits; 4 tests |
| `pnpm --filter @vibress/studio-react build` | Pass after final editor/test edits |
| `git diff --check` | Pass |

The first lint invocation failed with `ENOENT` while Playwright cleared
`test-results` concurrently. After browser testing finished, lint was rerun and
passed. Run these two commands sequentially in this checkout. Existing Vite
configuration/deprecation and playground bundle-size warnings remain.

## Compatibility, rollback and remaining gates

No document schema, persisted format, dependency, public prop or package export
was changed. Existing sanitizer boundaries are unchanged. Host persistence,
conflict resolution and durable recovery remain host-owned; pausing callbacks
does not cancel saves already in flight or confirm that a draft is stored.

Rollback is a source revert with no data migration. It restores the previous
recovery behavior and reintroduces this defect; stop authoring or retain local
drafts through the host before doing so. No deployed rollback was exercised.

The complete 12-week program remains open. In particular, named ownership and
ADR approval, known-node admission/unknown-field fidelity, bidirectional host
fixtures, clean external package installation, measured browser performance,
localized host recovery/export, manual screen-reader/device checks and release
approval require their own evidence. Existing green tests do not award a
numerical quality score or close those gates.

Not verified: Firefox/WebKit and real-device/screen-reader recovery. How to
verify: execute the plan's browser/manual matrix and record results for the
approved release candidate. The checked-in Playwright configuration currently
selects Chromium only.

Not verified: deployed host durability, independent review and rollout/rollback.
How to verify: follow the [host compatibility gates](../compatibility/host-runtime-parity-2026-11-05.md)
and [release readiness policy](../production-readiness.md) against named final
commits, with the accountable owners' sign-off.
