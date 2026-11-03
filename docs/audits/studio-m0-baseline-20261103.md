# M0 Independent Studio Capability, Risk and Validation Baseline

**Observed:** 2026-11-03; source-only audit. **Scope:** standalone main `8d1de75`, host main `0fcd4cf`. **Gate G0:** OPEN / NOT MET.

## Capability and compatibility matrix

| Surface | Standalone | Vibress host | Required action |
| --- | --- | --- | --- |
| Document model | `schema=vibress-studio`, v1 | same envelope and v1 | Keep format; cross-repo fixture equivalence |
| Media schemas | 13 card types, stricter Zod declarations | 13 types, some `default`/fallback handling | Test old incomplete metadata; no naive file replacement |
| Public package | private `@vibress/studio-react@0.1.0` | private `@vibress/studio-react@1.2.0` | Introduce explicit release/sync ownership |
| Editor core | Lexical, basic history and card commands | Lexical, host editor-state safeguards and Yjs collaboration | Host remains in-use compatibility reference |
| Media workflow | upload adapter and per-card editors | upload+request media context, floating toolbar, six metadata popovers | Port only after UX + adapter contract tests |
| AI | InlineAIPlugin used unconditionally and mock-like behavior | feature gated `enableAi`, `onAiGenerate` provider path | Never ship fabricated output; preserve host provider control |
| State sync | initial-value-only plugin; `value` updates not reapplied | content-hash checks and external state propagation | Define reset/restore contract; no silent data loss |
| Editor CSS | host-facing class names without standalone stylesheet export | broad Admin globals and `studio-*` classes | Namespaced standalone CSS with token bridge and isolated playground |
| RTL | several hardcoded physical offsets and LTR placements | some direction-aware logic, still physical offsets | Test Arabic/mixed-script and touch viewport |
| Accessibility | 20px block buttons, hover discovery | 20px block buttons, hover discovery | 24px+ accessible targets + keyboard block actions |
| Serialization | core/card normalization | format remains v1, host regression tests | Cross-repo golden fixtures and save/reload/preview |
| Host persistence | absent | PostEditor/PageEditor `expectedVersion`, autosave, conflict messaging | Never move persistence into Studio |
| Testing | standalone unit/security/axe/Playwright | expanded Yjs, truncation, media/host E2E suites | Preserve, augment and cross-check both |

## Confirmed source-level issues (prioritize by user harm, not visual novelty)

| ID | Severity | Evidence | Required proof to close |
| --- | --- | --- | --- |
| STU-001 | P0 | `SlashMenuPlugin` in both repos builds `new RegExp(queryString)` from author input | Literal search tests for `[`, `(`, `.*`, Arabic, case-folding; host/standalone CI |
| STU-002 | P0 | Both block-handle `handleDuplicate` functions insert an **empty paragraph** | Lexical duplicate of complete text/card, undo, selection and serialize/reload tests |
| STU-003 | P0 | Both toolbar color actions write DOM inline styles, not serialized Lexical state | Format survives undo, save/reload, public render and collaboration |
| STU-004 | P0 | Host `PageEditor` uses `key={`\${pageId || "new"}-\${version}`}` for `VibressStudio` | Autosave/version update does not remount, erase selection or discard typing |
| STU-005 | P0 | Standalone lacks host media, collaboration and state-sync capabilities | File-level export/API parity and runtime scenario matrix |
| STU-006 | P0 | `@lexical/history` and `@lexical/utils` host dependencies differ from core `lexical` version | Lockfile audit, Yjs compatibility and complete editor E2E |
| STU-007 | P1 | Standalone has no standalone CSS contract; host globals supply typography/popup/card classes | Isolated package visual tests and CSS export/import documentation |
| STU-008 | P1 | Hover-only block handles and misleading drag affordance | Real single-pointer reorder alternative, keyboard and SR QA |
| STU-009 | P1 | Native `prompt()` links and `alert()` AI toolbar in both sources | Accessible editing UI, honest AI provider state and focus restoration |
| STU-010 | P1 | Host `PageEditor` timer captures `savePage` closure from render and `studioDoc` state | Rapid-edit/offline/conflict tests ensure latest content is saved |
| STU-011 | P1 | Standalone markdown-it and Zod advisories block build before tests | Patched compatible versions with reviewed lockfile and full suite |
| STU-012 | P1 | Host main E2E currently fails, including media picker and public-card tests | Reproduce from logs; narrow fix; green CI exact SHA |

## CI evidence (not proof of runtime quality)

| Repository | Run / SHA | Result | Observed blocker |
| --- | --- | --- | --- |
| standalone | [41657137549](https://github.com/AbdullahZaher/vibress-studio/actions/runs/41657137549) / `c8c26e5` (docs PR) | FAIL | production audit reports 3 high vulnerabilities: markdown-it (`<14.3.2` and `>=14.1.0 <14.3.3`) and Zod; dependent checks not reached |
| standalone | [39647673777](https://github.com/AbdullahZaher/vibress-studio/actions/runs/39647673777) / `8d1de75` | FAIL | historical production audit |
| host | [41653585041](https://github.com/AbdullahZaher/vibress/actions/runs/41653585041) / `0fcd4cf` | FAIL | build/container scan succeeded; E2E failed in multiple scenarios incl. media picker, setup and public cards |
| host | [41649334420](https://github.com/AbdullahZaher/vibress/actions/runs/41649334420) / `348160a` | PASS | different SHA, **not** valid certification of current main |

The standalone CI reports **five vulnerabilities total** (three high, one moderate, one low). Do not bypass audit or weaken the threshold. The host failure list is from the workflow logs and must be diagnosed individually rather than assumed to be Studio-caused.

## Required independently collected evidence (currently missing)

- A reproducible clean checkout with Node 24, pnpm 11.17 and full `lint/typecheck/unit/build/audit/Playwright` results.
- Before screenshots at 320/360/390/768/1024/1440 px, light/dark, EN/AR, selection, card and mobile keyboard.
- Human keyboard, NVDA/Chrome and VoiceOver/Safari evaluations of actual writer tasks.
- Save/reload/undo/revision/restore and Yjs collaboration fixtures with existing persisted v1 documents.
- Published theme-to-editor parity inspection and measured interaction/performance baselines.
- Two independent reviewers and documented weighted category scores. **No 9.7 rating can be assigned yet.**

## Release policy

Freeze broad UI refactoring pending G0 review; allow independently scoped P0 fixes with regression tests. Do not mark any gate complete based on source inspection, a historic successful run or an unreviewed self-score. PRs should be draft until their own evidence is collected. Rollback: keep the previous package and schema v1, and revert individual editor feature branches; verify old documents and published pages after rollback.

## Sources

- [Standalone Studio code](https://github.com/AbdullahZaher/vibress-studio/tree/main/packages/studio-react/src)
- [Host Studio code](https://github.com/AbdullahZaher/vibress/tree/main/packages/studio-react/src)
- [Host PageEditor](https://github.com/AbdullahZaher/vibress/blob/main/apps/admin/src/components/PageEditor.tsx)
- [Host PostEditor](https://github.com/AbdullahZaher/vibress/blob/main/apps/admin/src/components/PostEditor.tsx)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [Ghost editor](https://ghost.org/help/using-the-editor/)
