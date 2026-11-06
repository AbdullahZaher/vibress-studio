# Vibress Studio — 9+ Master Execution Findings Register

**Status:** ACTIVE VERIFIED BASELINE  
**Date:** 2026-11-06  
**Repositories:**
- Studio: `https://github.com/AbdullahZaher/vibress-studio` (Base SHA: `36fac36d981ee8611b71e0ffecd978ad4773b499`)
- Host: `https://github.com/AbdullahZaher/vibress` (Base SHA: `08a727486eaa20d922b3decfee5cf8cff5e5d54b`)

---

## 1. Baseline Test & Check Verification Matrix

| Suite / Command | Scope | Target | Result | Evidence |
|---|---|---|---|---|
| `pnpm run lint` | Studio | ESLint 0 errors | PASS | 0 errors, 9 allowed warnings |
| `pnpm run typecheck` | Studio | TypeScript strict across 14 packages | PASS | All 14 packages clean in 1.7s |
| `pnpm test` | Studio | Vitest 54 test files | PASS | 54/54 files, 515/515 tests passed |
| `pnpm run verify:explicit-any` | Studio | <= 50 explicit any | PASS | 0 explicit any (max 50) |
| `pnpm run verify:lexical` | Studio | Lexical 0.14.3 coherence | PASS | 32 declarations across 14 packages verified |
| `pnpm run verify:package-exports` | Studio | 13 package export maps | PASS | 13/13 packages passed |
| `pnpm run verify:consumer-imports` | Studio | ESM / CJS / SSR / CSS | PASS | PASS (zero regressions) |
| `pnpm run verify:packed-consumer` | Studio | Tarball clean install | PASS | 13 packages clean install, Bundler resolution |
| `pnpm run verify:host-compatibility` | Cross-repo | Host core vs Studio fixtures | PASS | 9/9 fixtures matched on Host SHA `08a72748` |
| `pnpm run docs:build` | Studio | VitePress documentation | PASS | Complete in 3.10s |
| `pnpm run test:security` | Studio | Markdown, URL, HTML policies | PASS | 5/5 files, 22/22 tests passed |
| `pnpm run test:a11y` | Studio | Rendered semantic headings/labels | PASS | 1/1 files, 2/2 tests passed |
| `pnpm run test:roundtrip` | Studio | Serialization round-trip | PASS | 2/2 files, 29/29 tests passed |
| `pnpm run benchmark:document` | Studio | 1k–50k word CPU pipeline | PASS | 1k words: 0.088ms ser, 0.5ms HTML; 50k: 1.65ms ser, 15.67ms HTML |
| `pnpm run typecheck` | Host | Nx 71 projects | PASS | 71/71 projects passed in 7s |
| `pnpm run verify:explicit-any` | Host | <= 220 explicit any | PASS | 194 (max 220) |
| GitHub CI `push` (`42277615501`) | Host `main` | Build + Container scan | PASS | Build in 15m58s, Container scan in 3m15s |
| GitHub CI `push` (`42277615501`) | Host `main` | Playwright E2E suite | 197 PASS, 7 FAIL | 7 test selector/timing defects identified below |

---

## 2. Comprehensive Findings Register

### FINDING-HOST-E2E-01
- **Severity:** P0 (Release-blocking CI failure)
- **Repository:** `vibress`
- **Location:** `tests/e2e/content-flow.test.ts:61`, `apps/admin/src/components/PostEditor.tsx:1180-1205`
- **Root cause:** The E2E test `content-flow.test.ts` was waiting for `button:has-text("Publish Now")`, whereas `PostEditor.tsx` renders `{tr("Publish")}`. Furthermore, once published, `Unpublish` is only accessible inside the settings panel if closed, whereas the test expects `button:has-text("Unpublish")`.
- **User impact:** Authors who publish cannot easily 1-click unpublish from the header; CI fails on main push.
- **Required correction:**
  1. In `PostEditor.tsx`: Expose `{tr("Unpublish")}` on the header when `status === "published" && canPublish` so authors have immediate access to unpublish.
  2. In `tests/e2e/content-flow.test.ts`: Allow `button:has-text("Publish"), button:has-text("Publish Now")`.
- **Status:** CONFIRMED — Ready for implementation.

### FINDING-HOST-E2E-02
- **Severity:** P0 (Release-blocking CI failure)
- **Repository:** `vibress`
- **Location:** `tests/e2e/media-delete-protection.test.ts:152`, `tests/e2e/media-flow.test.ts:38`
- **Root cause:** Legacy Playwright tests used `li:has-text("Gallery")` and `li:has-text("Image")`. Studio's slash menu uses accessible WAI-ARIA `[role="option"]` (`div.studio-slash-item[role="option"]`), not `<li>` elements.
- **User impact:** E2E tests for media picker and delete protection time out after 45s.
- **Required correction:** Update test selectors to `page.locator('[role="option"]:has-text("Gallery"), li:has-text("Gallery")').first()` and `page.locator('[role="option"]:has-text("Image"), li:has-text("Image")').first()`.
- **Status:** CONFIRMED — Ready for implementation.

### FINDING-HOST-E2E-03
- **Severity:** P0 (Release-blocking CI failure)
- **Repository:** `vibress`
- **Location:** `tests/e2e/setup-wizard.test.ts:107`
- **Root cause:** `setup-wizard.test.ts` asserts `toContainText("Analytics")` on body after installation. The redesigned dashboard displays "Dashboard", "Overview", and "Web traffic".
- **User impact:** Fresh install wizard E2E fails on CI.
- **Required correction:** Update expectation to verify "Dashboard" or "Overview".
- **Status:** CONFIRMED — Ready for implementation.

### FINDING-HOST-E2E-04
- **Severity:** P0 (Release-blocking CI failure)
- **Repository:** `vibress`
- **Location:** `tests/e2e/studio-public-render.test.ts:191`
- **Root cause:** The test clicks `button:has-text("Create Post")`, but the header button in `PostsList.tsx` is `{tr("New Post")}`.
- **User impact:** Public card rendering E2E times out waiting for "Create Post".
- **Required correction:** In `PostsList.tsx`, add `data-testid="create-post-button"`, and in tests allow `button:has-text("New Post"), button:has-text("Create Post")`.
- **Status:** CONFIRMED — Ready for implementation.

### FINDING-HOST-E2E-05
- **Severity:** P1
- **Repository:** `vibress`
- **Location:** `tests/e2e/admin-ui-design-acceptance.test.ts:104`
- **Root cause:** `admin-ui-design-acceptance.test.ts` asserts `toHaveCount(2)` on `getByText("No activity in this period")`. The Overview tab now contains 1 primary interactive timeseries chart for views/visitors, so the count is 1.
- **User impact:** Design acceptance test fails.
- **Required correction:** Expect count >= 1 or 1 for the overview chart empty state.
- **Status:** CONFIRMED — Ready for implementation.

### FINDING-HOST-E2E-06
- **Severity:** P1
- **Repository:** `vibress`
- **Location:** `tests/e2e/content-modeler-flow.test.ts:15-16`
- **Root cause:** In Arabic locale or during route transition, `page.getByRole("button", { name: "Advanced", exact: true })` times out because the label is `المتقدمة` or needs navigation wait for `/admin/settings`.
- **User impact:** Content modeler E2E times out.
- **Required correction:** Use bilingual regex `/Advanced|المتقدمة/i` and wait for navigation.
- **Status:** CONFIRMED — Ready for implementation.

### FINDING-YJS-RESTORE-01 (Track H2 / Phase 02)
- **Severity:** P0 (Critical Architectural Integrity)
- **Repository:** `vibress`
- **Location:** `apps/admin/src/components/PostEditor.tsx:183-187`, `apps/api/src/routes/posts.ts:647-669`, `apps/api/src/collaboration/room-manager.ts`
- **Root cause:** Restoring a revision in PostgreSQL updates the database row, but does not reset the Yjs room in memory/Redis or broadcast an epoch fence to connected peers. Therefore, collaborative restoration was gated with `restoreDisabledReason`.
- **User impact:** Collaborative editing sessions cannot restore revisions.
- **Required correction:** Coordinated Yjs restoration protocol:
  1. Authorize restoration and validate publication/post identity.
  2. Increment document `epoch` / fencing token in database.
  3. Reset Yjs room state in Redis and in-memory `CollaborationRoom`.
  4. Broadcast `restore` event with new epoch and full restored snapshot to all connected WebSocket clients.
  5. Reject any WebSocket updates carrying an obsolete epoch.
  6. Lift `restoreDisabledReason` in `PostEditor.tsx`.
- **Status:** CONFIRMED — Target for Phase 02.

### FINDING-OFFLINE-RECOVERY-01 (Track H3 / Phase 03)
- **Severity:** P0 (Crash / Connectivity Recovery)
- **Repository:** `vibress`
- **Location:** `apps/admin/src/components/PostEditor.tsx`, `apps/admin/src/lib/recovery/`
- **Root cause:** No browser-local IndexedDB persistence exists in the host admin. If connectivity fails and the browser tab is refreshed or crashed, unsaved edits are lost.
- **User impact:** Authors lose in-flight drafts upon tab closure during network failures.
- **Required correction:** Scoped IndexedDB store keyed by `(publicationId, userId, postId, epoch)` storing timestamped snapshots, with recovery banner, diff review, and truthful save states.
- **Status:** CONFIRMED — Target for Phase 03.

### FINDING-STUDIO-WRITING-UX-01 (Phase 04)
- **Severity:** P1 (Product Quality)
- **Repository:** `vibress-studio`
- **Location:** `packages/studio-react/src/plugins/SlashMenuPlugin.tsx`
- **Root cause:** Slash menu items need category groupings, keyboard navigation refinement, bilingual filter ranking, and Ghost Koenig-level typography rhythm.
- **Required correction:** Refine slash menu ranking, keyboard caret positioning, reading measure rhythm, selection styling.
- **Status:** CONFIRMED — Target for Phase 04.
