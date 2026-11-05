# ADR-0001: Studio runtime ownership and two-repository synchronization

- **Date:** 2026-11-03
- **State:** Proposed — implementation approval pending baseline gate G0
- **Scope:** `AbdullahZaher/vibress` and `AbdullahZaher/vibress-studio`
- **Decision owners:** Studio platform, Vibress Admin integration, security, accessibility and release reviewers (assign people before approval)

## Context and verified evidence

Both repositories contain a `packages/studio-*` workspace, but they are **not interchangeable**. Historical observed SHAs on 2026-11-03 were:

- Standalone main: `8d1de75987fff78cd12e19564f1db9dafaa75e4c`.
- Vibress host main: `0fcd4cfa383216a1092ff25ea26ad04edbe876a9`.

The host `@vibress/studio-react` is version `1.2.0`; the standalone package declares `0.1.0` and `private: true`. Both now contain media context, media toolbars/popovers and opt-in AI callbacks. The host additionally provides WebSocket/memory Yjs collaboration and host-specific editor state/persistence integration not exposed by standalone Studio. Standalone implements a different `replacementId` synchronization contract. Host `PostEditor` and `PageEditor` own persistence and conflict behavior; that behavior has not been demonstrated interchangeable with standalone.

The two repositories retain `schema: 'vibress-studio'`, `version: 1` and legacy-card normalization, but card Zod default behaviors differ and must be tested with old persisted content. Source trees and version numbers are evidence of divergence, *not* proof that every runtime flow is broken.

## Decision

**Proposed Option B (not yet approved): Vibress monorepo remains the runtime reference for currently shipped host functionality.** Do not treat this recommendation as permission to sync, merge or deploy until maintainers explicitly approve this ADR and a tested extraction/release workflow.

1. Production-facing editor, card/runtime integrations and document behavior continue to be maintained in `AbdullahZaher/vibress`. Do not replace them with the older standalone files.
2. `AbdullahZaher/vibress-studio` is a **downstream compatibility/distribution target**, not a competing place to independently redesign persisted content or integration contracts.
3. Document schema remains `vibress-studio` v1; all migrations must remain forward-compatible and retain legacy-card parsing. No global schema rewrite.
4. Transfer changes deliberately, after a **named host commit**, a file-level capability diff, backwards-compatible contract review and full standalone/host tests. Do not use unreviewed bidirectional copying or direct source deep imports.
5. Create a future versioned release/synchronization workflow that transfers tested public packages and CSS assets into standalone. Pin a documented host SHA per sync; verify package exports, normalized fixtures and public rendering in both repos. Until then, synchronization is manual, PR-reviewed and **never assumed complete**.
6. The Vibress Admin owns autosave, conflict detection, permissions, publication context, authoritative media/AI services and collaboration session setup. The editor owns Lexical state, selection, commands and serialized change callbacks. Public themes do not own editor color tokens; Studio appearance defaults to Admin tokens with standalone fallbacks.
7. Publish/release decisions require green tests *and* manual browser evidence. CI outcomes and quality scores belong to the exact reviewed SHA. No automatic merge to main.

## Alternatives examined

- **A. Standalone canonical immediately:** rejected for the active runtime because copying its current `VibressStudio` into the host drops host-only features and existing regression safeguards.
- **B. Host canonical with extraction:** preferred proposal, pending owner sign-off, to protect deployed functionality and allow a future reusable standalone distribution.
- **Indefinite dual-authoritative editing:** rejected; persistent divergence makes compatibility and bug fixes unverifiable.

## Explicit compatibility invariants

- An existing v1 Studio document must continue to render and round-trip after any change in either repository.
- Existing card types, media references, captions, alt text, mark/format styles and public HTML remain accepted.
- Page/post saving remains host-controlled with `expectedVersion` conflict checks; content input must not trigger a destructive remount during autosave.
- Yjs collaboration retains the host provider lifecycle and model; do not introduce an independent collaboration backend.
- Arabic/English/mixed-direction content, keyboard usage and read-only views remain functional.
- Public package consumers see only additive, documented API/export changes until a separately approved major migration.
- Security checks, sanitization, upload authorization and configured-provider AI boundaries remain in force.

## Consequences and follow-up

- This ADR **does not approve shipping**, declare Phase 0 complete, or assert that standalone now has host features.
- Prioritize a reproducible fixture/contract parity suite and CI stabilization before design-system or editor-state rewrites.
- Verify the host's mixed Lexical package versions (`0.13.1` vs `0.52.0`) for API compatibility before dependency changes; no blind alignment.
- Introduce a CSS export/import contract and screen-reader/RTL evidence before making standalone a supported editor distribution.
- Revisit this ADR only after a tested automated sync pipeline and independent package release process exist.

## Reversal / rollback

No runtime behavior is changed by this decision. To reverse it, draft a new ADR, create a complete public-contract/fixture parity suite, and demonstrate safe migration of in-use host integrations to the alternative canonical source. Do not quietly switch ownership or deploy without rollback evidence.

## References

- [Host Studio exports](https://github.com/AbdullahZaher/vibress/blob/main/packages/studio-react/src/index.ts)
- [Standalone Studio exports](https://github.com/AbdullahZaher/vibress-studio/blob/main/packages/studio-react/src/index.ts)
- [Host editor](https://github.com/AbdullahZaher/vibress/blob/main/packages/studio-react/src/VibressStudio.tsx)
- [Host post persistence](https://github.com/AbdullahZaher/vibress/blob/main/apps/admin/src/components/PostEditor.tsx)
- [Host page persistence](https://github.com/AbdullahZaher/vibress/blob/main/apps/admin/src/components/PageEditor.tsx)
- [UX roadmap (documentation PR #1)](https://github.com/AbdullahZaher/vibress-studio/blob/docs/studio-global-quality-roadmap-20261103/docs/roadmaps/global-ux-quality-roadmap.md)

## 2026-11-05 verification checkpoint (informational; ADR remains Proposed)

- Host main reference: `b33fb1ab597bfabb8861516132cf8bad567f0bf1`; standalone assessment PR #28 reference: `36445d0288bed112e84944b838bea7373589d5bc`.
- Host autosave remediation is proposed separately in [Vibress PR #124](https://github.com/AbdullahZaher/vibress/pull/124), with no merge authorization or assumed runtime parity.
- To approve this ADR, require an owner sign-off, bidirectional document/card fixture checks, pinned Lexical and Yjs compatibility evidence, two-client collaboration/persistence tests, and a reversible migration path.
