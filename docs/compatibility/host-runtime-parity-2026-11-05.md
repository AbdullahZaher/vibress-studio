# Host/Standalone Studio Compatibility Evidence — 2026-11-05

**Status: SOURCE COMPARISON ONLY; NOT APPROVED FOR HOST REPLACEMENT.**
ADR-0001 remains Proposed; this document cannot approve it.

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

## References

- [Host React package](https://github.com/AbdullahZaher/vibress/blob/b33fb1ab597bfabb8861516132cf8bad567f0bf1/packages/studio-react/package.json)
- [Standalone React package](https://github.com/AbdullahZaher/vibress-studio/blob/36445d0288bed112e84944b838bea7373589d5bc/packages/studio-react/package.json)
- [Host React editor](https://github.com/AbdullahZaher/vibress/blob/b33fb1ab597bfabb8861516132cf8bad567f0bf1/packages/studio-react/src/VibressStudio.tsx)
- [Standalone React editor](https://github.com/AbdullahZaher/vibress-studio/blob/36445d0288bed112e84944b838bea7373589d5bc/packages/studio-react/src/VibressStudio.tsx)
- [Host PostEditor](https://github.com/AbdullahZaher/vibress/blob/b33fb1ab597bfabb8861516132cf8bad567f0bf1/apps/admin/src/components/PostEditor.tsx)
- [Host PageEditor](https://github.com/AbdullahZaher/vibress/blob/b33fb1ab597bfabb8861516132cf8bad567f0bf1/apps/admin/src/components/PageEditor.tsx)
- [ADR-0001](../adr/0001-studio-canonical-runtime.md)
