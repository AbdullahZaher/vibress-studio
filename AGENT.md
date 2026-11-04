# AGENT.md — Vibress Studio

Operating manual for AI coding agents (and human contributors) working on **Vibress Studio** (`vibress-studio`), the reusable rich-content editor for the Vibress CMS.

> **Source-of-truth rule.** This file describes intent, standards, and process. It may lag behind the code. When this file, other docs, or milestone notes disagree with source code and executable evidence (tests, builds, CI), **source and evidence win**. Report the discrepancy; do not paper over it.

---

## 0. How to use this file

1. Read sections 1–4 once per task to load the mission, scope, and invariants.
2. Jump to the section that matches the task type (see §17 "Task playbooks").
3. Before finishing, run the checklist in §15 and report using the format in §19.
4. If a rule here conflicts with an explicit instruction from the repository owner in the current task, follow the owner, say so in your report, and flag any security or data-integrity risk the deviation creates.

**Conventions used here**

- **MUST / MUST NOT** — non-negotiable.
- **SHOULD / SHOULD NOT** — default; deviate only with a stated reason.
- **Proposal** — a direction that is not implemented. Never describe a proposal as a shipped feature.
- Commands are examples of the repository's scripts. Verify they exist in `package.json` before relying on them.

---

## 1. Mission and role

You act as the **senior engineering team** for Vibress Studio. Specialist hats you wear:

| Role | Focus |
| --- | --- |
| Editor / Lexical engineer | Nodes, commands, transforms, selection, history, serialization |
| React UX engineer | Toolbars, menus, popovers, inspector panels, keyboard flows |
| Document architect | Schema, versioning, migration, round-trip guarantees |
| Security engineer | Sanitization, URL policy, embed policy, XSS regressions |
| Package engineer | Exports map, ESM/CJS, type declarations, CSS exports, bundle size |
| Accessibility / RTL engineer | Screen readers, focus, bidi text, Arabic typography |
| QA engineer | Unit, integration, e2e, a11y, round-trip, and security tests |

For any substantial task, name **one Lead Role** and justify important decisions briefly. Small tasks do not need ceremony.

**Mission:** give authors a calm, fast, reliable writing and layout experience on par with the best publishing editors, while giving host applications a small, stable, secure, well-documented integration surface.

---

## 2. Product scope

### 2.1 What Studio is

- A **versioned document model** (`schema: 'vibress-studio'`, version `1`) with validation and migration.
- A **Lexical-based React editor** with rich text, blocks, and cards.
- **Content cards**: serializable contracts, editor components, and safe renderers.
- **HTML and Markdown import/export** with a strict allowlist sanitizer.
- **Server-safe rendering** of documents to HTML (no React or Lexical required on the server path).
- A **plugin SDK** for registering cards, commands, toolbar items, and renderers.
- **Host-provided integrations** for media (upload/pick) and AI generation.

### 2.2 What Studio is not

- **Not a CMS or backend.** No auth, no persistence layer, no database, no publishing workflow, no revision store, no durable media storage.
- **Not a page builder with free-form absolute positioning.** Layout flexibility MUST come from serializable, responsive, RTL-safe blocks and cards.
- **Not an AI product.** AI is an opt-in hook the host controls.
- **Not a sandbox for untrusted plugin code.** Plugin registration is not isolation.

If a task pushes Studio toward any "not" item, stop, explain the scope expansion, and ask for approval before proceeding.

### 2.3 Primary users

1. **Authors** writing long-form articles, often in **Arabic, English, or mixed direction**.
2. **Host developers** embedding the editor (initially the Vibress CMS) through public packages.
3. **Plugin authors** extending cards and commands.
4. **Readers** of server-rendered output (they MUST never be exposed to unsafe markup).

---

## 3. Benchmark editors (UX references only)

Studio is measured against the quality bar of mature publishing editors. Use them to answer "what do authors expect here?", never as code or asset sources.

### 3.1 What to learn from each

**WordPress — Gutenberg (block editor)**
- Searchable **block inserter** with categories and recently used items.
- **Contextual block toolbar** and a **document/block settings sidebar**.
- **List View / outline** for navigating and reordering a long document.
- **Block transforms** (paragraph ↔ heading ↔ quote ↔ list) preserving content.
- **Reusable patterns** and templates for repeatable layouts.
- Predictable paste handling and clear "this block has unexpected content" recovery.

**Ghost — Koenig editor**
- A **calm, distraction-light writing surface** where the content dominates the chrome.
- The `+` button and `/` **card menu**, plus **Markdown shortcuts** (`#`, `-`, `1.`, `>`, ` ``` `).
- A **floating selection toolbar** limited to the formats that matter.
- **Rich cards** with inline settings: image, gallery, bookmark, embed, callout, toggle, button, HTML, divider.
- Card captions and card-level alignment/width options.

**Notion / Medium**
- **Slash commands**, drag handle **plus keyboard move**, minimal formatting toolbar.
- Turn-into conversions and forgiving paste-to-embed behavior.

**Wix / Squarespace (visual builders)**
- Visual polish, **device preview** (desktop/tablet/mobile), **style presets**, section-level layouts.
- Adopt these ideas **only** as serializable section/card data with responsive and RTL-safe rendering. Never introduce absolute positioning or pixel-pinned layouts that break on other viewports or in RTL.

### 3.2 Rules of engagement

- **Borrow interaction patterns and accessibility lessons. Never copy code, assets, icons, copy text, or branding.** Licenses differ (for example, WordPress/Gutenberg is GPL-licensed; Wix is proprietary); check the license of anything before reading it closely, and when in doubt do not borrow implementation.
- **Verify current behavior** from the editor's public documentation or product before citing it in a PR. Do not rely on memory for "how X does it".
- **Never claim parity** ("works like Gutenberg") without tests demonstrating the behavior.
- **Adopt a pattern only if** it (a) serves mixed Arabic/English authors, (b) fits the document model without schema forks, (c) can be made accessible, and (d) does not require host-owned concerns inside Studio.
- Record the benchmark reasoning in the PR description: *which pattern, why, what we deliberately did differently*.

---

## 4. Hard invariants (read before every change)

1. **Never lose user content.** No silent resets, rewrites, truncation, or dropped nodes. If content cannot be understood, preserve it as an unknown/forward-compatible node.
2. **Never ship an XSS path.** Every output boundary sanitizes and escapes. See §10.
3. **Never fork the document format.** Schema changes go through versioning and migration. See §6.
4. **Never keep temporary media references.** No `blob:` or temporary URLs in persisted documents.
5. **Never fake behavior.** Every visible control does what it advertises; no placeholder completions, dead buttons, or DOM-only formatting that vanishes on serialization.
6. **Never fabricate verification.** Report only commands you actually ran and their real outcomes.
7. **Keep server-safe packages free of React and Lexical.**
8. **Keep host concerns in the host.** Auth, persistence, autosave, conflicts, storage, collaboration setup, AI gateway, secrets.

---

## 5. Repository, branches, and source of truth

### 5.1 Before you change anything

- Inspect the **relevant code, package exports, tests, docs, git state, and target branch**.
- Read `docs/architecture.md`, `docs/adr/0001-studio-canonical-runtime.md`, and any applicable security or compatibility docs.
- **Do not assume documented files or APIs exist.** Confirm in source. Some documentation and milestone claims may be stale.
- Check `git status` and recent history; preserve unrelated uncommitted work.

### 5.2 Host reference and synchronization

- For in-use runtime compatibility, treat `AbdullahZaher/vibress` as the **host reference** described by ADR-0001.
- Before any synchronization: **confirm the ADR status and the exact host commit SHA**.
- **Never blindly copy between repositories.** Never fork the document format. Never imply feature parity between Studio and the host without tests that prove it.
- Record the host SHA you compared against in the PR description.

### 5.3 Git workflow

- Work in **focused branches and PRs**. One concern per PR.
- Keep diffs **small and reviewable**; split mechanical changes (renames, formatting) from behavioral ones.
- **Never merge, force-push shared branches, publish packages, or deploy** without explicit authorization.
- Commit messages: imperative, scoped (for example `fix(studio-html): reject javascript: URLs in bookmark card`).
- Do not commit generated `dist` output, secrets, local env files, or unrelated lockfile churn.

---

## 6. Document model and integrity

### 6.1 Persisted shape

- Persisted documents use `schema: 'vibress-studio'` and `version: 1`.
- `studio-core` owns the schema, validation, and migration. Everything else consumes it.

### 6.2 Compatibility rules

You MUST preserve:

- Legacy **`react-studio-card` → `studio-card`** normalization.
- All existing **cards**, **text marks**, **styles**, **direction** (RTL/LTR/auto), **tables**, **captions**, and **media references**.
- **Unknown, forward-compatible nodes**: documents written by a newer version MUST survive a load/save cycle through an older version without data loss.

### 6.3 Boundaries

- All external data (host props, pasted content, imported HTML/Markdown, stored JSON) enters **only through existing validation and migration functions**. Do not add ad-hoc parsers that bypass them.
- Validation failures MUST be **visible and recoverable** (clear error, original content preserved), never swallowed.

### 6.4 Changing the schema (proposal workflow)

1. Write an ADR or design note explaining the change, alternatives, and migration plan.
2. Make changes **additive** whenever possible (new optional fields, new node types).
3. If a version bump is truly needed, implement a **forward migration with tests** and keep readers for old versions.
4. Add fixtures: *old-document → current model*, *current → serialized → reloaded*, and *unknown-node preservation*.
5. Update docs, `studio-testing` fixtures, and the host compatibility notes.
6. Get explicit approval; this is P0-class work.

### 6.5 Round-trip guarantees

Before touching serialization, establish the baseline: save → reload → compare; export → import → compare; export → render → compare. After your change, all must still hold, and you MUST add a test for the new behavior. Lossy conversions (for example Markdown, which cannot represent every card) MUST be **documented** and, where possible, degrade to a safe, readable fallback rather than silently dropping content.

---

## 7. Architecture and dependency rules

### 7.1 Package map

| Package | Responsibility | Environment |
| --- | --- | --- |
| `studio-core` | Canonical document schema, validation, migration | Server-safe |
| `studio-card-definitions` | Serializable card contracts (Zod) and safe rendering | Server-safe |
| `studio-cards` | Compatibility exports and the Lexical card node | Editor |
| `studio-renderer` | Server-safe HTML output | Server-safe |
| `studio-html` | HTML import/export | Server-safe |
| `studio-markdown` | Markdown import/export | Server-safe |
| `studio-serializer` | Document ↔ editor-state conversion helpers | Server-safe where applicable |
| `studio-utils` | Shared safety primitives (sanitizer, URL validation, escaping) | Server-safe |
| `studio-nodes` | Lexical nodes | Editor |
| `studio-transforms` | Lexical transforms and interactions | Editor |
| `studio-react` | React UI, media and AI hooks | Editor |
| `studio-plugin-sdk` | Plugin registration API | Editor / shared types |
| `studio-testing` | Fixtures and test helpers | Dev |
| `tests`, `e2e`, `playground` | Verification and manual harness | Dev |

> Verify this map against the actual workspace before relying on a package boundary. If reality differs, report it.

### 7.2 Rules

- **Server-safe packages MUST NOT import React, Lexical, or DOM-only APIs.** Add or keep a lint/test guard when feasible.
- **Import through public package exports only.** No deep imports into another package's private paths.
- **Preserve the export contracts**: ESM and CJS entry points, type declarations, and CSS exports. Run the export verification script after any change to a `package.json` `exports` map, entry file, or build config.
- **Dependency direction** flows from low-level (`studio-core`, `studio-utils`) up to editor packages. No cycles. If you need a cycle, the abstraction is in the wrong package.
- **Keep public APIs additive.** A breaking change requires documentation, tests, a migration note, and explicit approval.
- Prefer small, composable internal modules over large files. Co-locate tests with the code they cover.

### 7.3 Stack (use what is installed)

Node 24, pnpm 11.17+, TypeScript, React 18.3, Lexical 0.13.1, Zod, Vite (playground), CSS tokens, Vitest, Playwright, ESLint, GitHub Actions.

- Use installed versions and workspace dependencies. Read the Lexical 0.13.1 types and source in `node_modules` rather than recalling newer APIs.
- **Do not introduce** Next.js, Supabase, a new state-management framework, or major dependency upgrades without a demonstrated need and a compatibility review (bundle size, peer ranges, license, security history).
- Do not add a dependency for something achievable in a few lines of well-tested code.

---

## 8. Editor engineering (Lexical + React)

### 8.1 Ownership

- **The editor owns:** Lexical state, selection, commands, card editing UX, and `onChange` snapshots.
- **The host owns:** authentication, publication context, persistence and autosave, revision conflicts, durable storage, collaboration setup, and the AI gateway.
- **Do not** build competing host services inside Studio, and **do not remount the editor destructively on save** (this loses selection, undo history, and in-flight uploads).

### 8.2 Behavioral guarantees

- **Selection** is preserved across toolbar actions, card edits, and external value synchronization when possible.
- **Undo/redo** is coherent: one user intent = one history entry; async completions (upload finished, AI result inserted) integrate cleanly without corrupting history.
- **Read-only mode** disables every mutating control and shortcut, not only the contenteditable.
- **External value sync** (host passes a new value) MUST not clobber unsaved local edits without a defined policy and MUST not echo infinite `onChange` loops.
- **`onChange`** emits canonical, validated snapshots; avoid emitting on every keystroke if a debounced/idle strategy is the documented contract (check the existing contract first).

### 8.3 Implementation guidance

- Mutate editor state **only inside `editor.update()`**; read inside `editor.getEditorState().read()` or update callbacks. Never keep stale node references across updates.
- Register commands with explicit priorities and **return `true` only when handled**.
- Prefer **node transforms** for invariants (for example normalizing empty nodes), and keep them idempotent and cheap.
- Implement `importDOM`/`exportDOM`/`exportJSON`/`importJSON` deliberately for every custom node and keep them consistent with the document schema.
- Decorator nodes (cards) MUST define keyboard focus behavior, selection behavior, deletion behavior, and copy/paste behavior.
- **Direction** is data: support per-block `dir` (LTR/RTL/auto) and ensure it survives serialization and paste.
- Clean up listeners and registrations on unmount; no leaks across remounts in React 18 strict mode.

### 8.4 Visible controls must work

Every toolbar button, menu item, shortcut, and inspector field MUST:

1. Perform its advertised action on the real document model.
2. Survive **serialization and reload**.
3. Reflect state accurately (active/disabled/mixed).
4. Have an accessible name and keyboard path.

If a feature is not implemented, **hide it or mark it honestly as unavailable**. Do not ship cosmetic stubs.

---

## 9. Authoring experience targets

These are the capabilities authors expect from a publishing-grade editor. Items are **targets, not claims**: check the code and docs to learn what is implemented, then improve in priority order. Each item must work in **RTL, LTR, and mixed-direction** text and be keyboard-accessible.

### 9.1 Writing flow
- Smooth typing with no perceptible latency on long documents (measure; see §13).
- **Markdown shortcuts** for headings, lists, quotes, code, dividers; inline marks (`**bold**`, `*italic*`, `` `code` ``, links).
- Predictable Enter/Backspace/Tab behavior in lists, quotes, headings, and cards.
- Smart handling of RTL/LTR switching and mixed runs (numbers, Latin words inside Arabic).

### 9.2 Insertion and discovery
- `+` inserter and `/` slash menu with **search**, categories, keyboard navigation, and recent items.
- Insert via plugin-registered cards with consistent metadata (title, description, keywords, icon).
- A clear, honest empty state for the document and for empty cards.

### 9.3 Formatting and block controls
- **Floating selection toolbar** (bold, italic, underline/strike where supported, link, inline code, text direction).
- Block-level controls: **move up/down, duplicate, delete, transform, align, width**, with both **pointer (drag) and keyboard** paths.
- **Block transforms** preserve content and direction.
- Validated **link popover** (URL policy from §10, open-in-new-tab and rel handling, remove link).

### 9.4 Navigation and structure
- **Outline / list view** for headings and cards, with jump-to and reorder where feasible.
- Word count, reading time, and heading structure hints (proposal; host may own display).

### 9.5 Paste and import
- **Clean paste** from Word, Google Docs, web pages, and other editors: normalize structure, strip dangerous or presentational junk, keep meaningful formatting, direction, tables, and links.
- Pasting images/files routes through `uploadMedia` host callbacks, never embeds `blob:` or raw data URLs in the persisted document.
- Pasting a bare URL MAY offer embed/bookmark conversion through the allowlisted providers.

### 9.6 Media, tables, embeds
- Image, gallery, video/audio (where supported), table (header rows, alignment, RTL), callout, toggle, button, bookmark, embed, HTML (heavily sanitized), divider.
- Captions and alt text are first-class and accessible.

### 9.7 Preview and fidelity
- **Editor/preview/published fidelity**: what authors see MUST match server-rendered output within documented differences.
- Device preview (desktop/tablet/mobile) and light/dark theme preview driven by CSS tokens (§12), not hard-coded styles.

### 9.8 Plugins
- Plugins can add cards, commands, toolbar/menu items, and renderers through `studio-plugin-sdk`. Plugin output is **untrusted** (§10).

### 9.9 Prioritization
Use §16 priorities. Reliability, content safety, and accessibility outrank novelty. Do not add a new benchmark-inspired feature while a P0/P1 defect in the same area is open without explaining why.

---

## 10. Security (non-negotiable)

### 10.1 Threat model

Treat **everything** as untrusted until sanitized at the boundary where it is used: stored documents, imported HTML/Markdown, **pasted content**, URLs, captions, alt text, card payloads, embed parameters, and **plugin renderers**. A document from the database may have been written by a compromised or older client.

### 10.2 Required controls

- Use the repository's **actual allowlist sanitizer** (in the shared safety package) and its URL validation and escaping helpers. Read them before writing new output code; do not invent parallel ones.
- Apply sanitization/escaping **at every output boundary**: server HTML render, HTML export, Markdown export (link/image destinations and text), clipboard export, editor decorator rendering, and plugin renderer output.
- **Never** rely on regex-only sanitization. **Never** use `dangerouslySetInnerHTML` with unsanitized data. If it is unavoidable, route through the shared sanitizer and add a test proving it.
- **URLs**: allow only safe schemes for each context (for example `http`, `https`, `mailto`, `tel` for links; `http`/`https` and verified hosts for media/embeds). Reject `javascript:`, `data:` (except explicitly allowed image types where the policy permits), `vbscript:`, and obfuscated variants (whitespace, control characters, mixed case, entity encoding).
- **Attributes**: allowlist per element. Reject all `on*` event-handler attributes, `style` payloads that can execute or exfiltrate (for example `expression()`, `url(javascript:)`), and unknown attributes by default.
- **Links** opened in new tabs MUST carry safe `rel` values.
- **Iframes/embeds**: only from **verified providers** with strict URL patterns, restricted attributes, and the minimum required `sandbox`/`allow` settings. Never accept arbitrary iframe HTML.
- **HTML card**: treat as the most dangerous surface. Sanitize with the strictest policy, never execute scripts, and document its limits.

### 10.3 Plugins

- **Plugin registration is not a sandbox.** Do not claim permission or capability guarantees the code does not enforce.
- Sanitize plugin-rendered output on the server path and in the editor.
- Do not give plugins access to credentials, host callbacks beyond what the SDK deliberately exposes, or unrestricted DOM access without documenting the risk.

### 10.4 Secrets and privacy

- **Secrets and privileged operations stay in the host.** Studio never stores API keys, tokens, or signing secrets, and never logs document content or user data.
- Do not send document text, selection, or metadata to any AI gateway without **host authorization and user consent**.
- Do not add analytics or network calls inside Studio.

### 10.5 XSS regression discipline

For **every new HTML surface** (new card, new import path, new renderer, new paste handler, new export format), add regression tests that cover at least:

- Script tags, `javascript:` URLs, `on*` handlers, SVG with script/handlers, `<iframe srcdoc>`, `<object>/<embed>`, `<meta refresh>`, `<base>`, CSS-based payloads, nested/obfuscated encodings, and mutation-XSS patterns (malformed nesting that re-parses differently).
- Both **import** and **render** paths, and the **round trip** (export → import → render).
- Unknown-node and plugin-renderer payloads.

Run the repository's security test script before declaring done.

---

## 11. Cards, media, AI, and plugins

### 11.1 Card contract

- A card has a **serializable definition** (in `studio-card-definitions`) and a separate **editor component** (in editor packages). Keep them decoupled so the server can render without React.
- **Validate data with the card's actual Zod contract** at creation, edit, import, and render. Do not hand-roll shape checks.
- New card checklist:
  1. Zod schema + defaults + version/migration notes.
  2. Safe server renderer (escaped, sanitized, responsive, RTL-aware).
  3. Editor component with accessible controls and keyboard behavior.
  4. Lexical node wiring (import/export JSON and DOM), copy/paste behavior.
  5. Inserter metadata (title, description, keywords, icon, category).
  6. HTML and Markdown import/export behavior, including documented fallback.
  7. Tests: schema, round-trip, XSS, a11y, e2e happy path.
  8. Docs and playground example.
- Legacy and unknown cards MUST still load, display a safe placeholder if necessary, and **survive saving unchanged**.

### 11.2 Media

- Media goes through **host callbacks** (`uploadMedia`, `requestMedia`) that return **permission-checked, durable assets**.
- **Never persist `blob:` URLs, temporary object URLs, or base64 payloads** in the document. Use them only for in-session preview.
- Upload lifecycle MUST handle: **progress, cancellation, failure, retry, timeout, partial gallery success, removed cards, and edits made while uploading** (captions, alt text, ordering, neighboring content).
- On completion, resolve the target by a stable identity (not by stale index/node key) and update only what the upload owns.
- Validate asset metadata (type, size, dimensions, URL policy) returned by the host before storing it.
- Always require/encourage **alt text** and provide an explicit "decorative" option.

### 11.3 AI integration

- AI is **opt-in**: enabled only via `enableAi` and implemented through the host's `onAiGenerate`.
- **Never fabricate** AI responses, simulate completions, or ship placeholder "AI results".
- Do not send document context to the host without the host's authorization and the user's consent signals; make the scope of context explicit in the callback contract.
- AI output is **untrusted input**: sanitize and validate it like pasted content before it enters the document.
- Handle loading, error, cancellation, and undo of AI insertions as a single coherent history step.

### 11.4 Plugin SDK

- Keep the SDK surface **small, typed, and additive**. Document every extension point.
- Registration order and conflicts (duplicate IDs, overriding built-ins) MUST be deterministic and reported clearly.
- Plugin cards follow the same checklist as built-in cards (§11.1).

---

## 12. UX, accessibility, RTL, and theming

### 12.1 Experience principles

- **Calm, editorial, content-first.** Chrome stays quiet; the document is the hero.
- **Progressive disclosure**: common actions are one step away; rare ones live in menus/inspectors.
- **Honest states**: loading, empty, disabled, and error states say what is happening and what to do next.
- **Forgiving**: undo works, destructive actions are recoverable, and errors never wipe content.
- Do not redesign unrelated UI without approval. Protect existing author workflows and editor/preview fidelity.

### 12.2 Accessibility (WCAG 2.2 AA as the working bar)

- Every interactive control has an **accessible name**, correct role, and state (`aria-pressed`, `aria-expanded`, `aria-disabled`, and similar).
- **Visible focus** at all times; logical focus order; focus is restored after menus, popovers, and dialogs close.
- Full **keyboard operation**: inserter, slash menu, toolbars, card controls, block move, link popover, dialogs. Provide **non-drag alternatives** for every drag interaction.
- **Touch targets** large enough for comfortable use on mobile and tablet.
- Announce meaningful changes (insertion, move, upload progress/failure) via appropriate live regions without being noisy.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`; do not rely on color alone.
- Run the a11y test script and manually keyboard-test any new interaction.

### 12.3 RTL, bidi, and Arabic typography

- Support **RTL, LTR, and auto** direction at block level; default direction is controlled by the host/document, not hard-coded.
- Use **CSS logical properties** (`margin-inline-start`, `inset-inline-end`, `text-align: start`) instead of left/right.
- Mirror icons whose meaning is directional (arrows, indent, quote marks as appropriate); do not mirror those that are not (for example media play).
- Test **mixed content**: Arabic with Latin words, numerals, URLs, punctuation, and inline code. Verify caret movement, selection, and list markers.
- Do not assume Latin line-heights or letter-spacing; never apply letter-spacing to Arabic text.
- Ensure exported HTML carries `dir`/`lang` information where the model has it.

### 12.4 Theming and CSS contracts

- Use the existing **`--vb-studio-*` CSS tokens** and keep the public CSS export contract stable. New tokens are additive and documented.
- Support **light and dark** themes and **desktop/tablet/mobile** layouts through tokens and responsive CSS, not inline literals.
- Avoid global CSS leakage: scope styles to the Studio root so host pages are unaffected.
- Editor styles and server-rendered styles MUST not diverge in ways that make preview misleading.

---

## 13. Performance and bundle hygiene

- Treat **typing latency, selection responsiveness, paste time, and initial load** as product features. The following are **initial working targets, to be validated by measurement before being quoted as facts**: no perceptible input lag on a long article (several thousand words with a few dozen cards), and no main-thread blocking on paste of large HTML.
- Avoid **unnecessary re-renders**: memoize heavy toolbars, avoid putting the full editor state in React state, keep decorator components isolated.
- Debounce or schedule expensive work (outline recomputation, word count, autosave-adjacent snapshots) off the keystroke path.
- Keep server-safe packages **lightweight and tree-shakeable**; avoid side effects at import time.
- Watch the **bundle size** of editor packages; justify and document any dependency that moves it noticeably. Lazy-load rarely used cards and heavy tooling.
- Large media previews use appropriately sized images and lazy loading; never inline large data.
- Provide a way to reproduce a performance concern (playground fixture + steps) before optimizing. No speculative optimization.

---

## 14. Testing strategy

### 14.1 Principles

- **Every fix ships with a focused regression test.** Every feature ships with tests at the right levels.
- Prefer **behavioral tests** (what authors/hosts observe) over implementation-detail tests.
- Tests MUST be deterministic: no arbitrary sleeps, no network, no reliance on wall-clock time. Fake timers and controlled promises for async upload/AI flows.
- Never weaken, skip, or delete a test to make a change pass. If a test is wrong, fix it and explain why.

### 14.2 Levels and what they cover

| Level | Tooling | Cover |
| --- | --- | --- |
| Unit | Vitest | Schema validation, migrations, sanitizer/URL rules, serializers, utilities |
| Integration | Vitest (+ DOM where needed) | Lexical nodes, transforms, commands, import/export pipelines |
| Security | Security test suite | XSS payload matrix across import, render, paste, plugin output |
| Accessibility | A11y test suite | Roles, names, focus order, keyboard paths, contrast tokens |
| Round-trip | Round-trip suite | save/reload, export/import, legacy fixtures, unknown nodes |
| E2E | Playwright | Authoring flows: type, insert card, upload (mocked host), reorder, save/reload, RTL, read-only |
| Package | Export verification | ESM/CJS entries, types, CSS exports, public imports |

### 14.3 Fixtures

- Keep **versioned fixtures** in the shared testing package: legacy `react-studio-card` documents, documents with unknown nodes, large documents, mixed-direction documents, and hostile payload corpora.
- When you fix a content-loss or compatibility bug, **add the offending document as a fixture**.

### 14.4 What must be exercised for editor changes

Typing and Markdown shortcuts; selection and undo/redo around your change; read-only mode; external value sync; save → reload; copy/paste (within editor and from external sources); keyboard-only operation; RTL and mixed text; light/dark and narrow viewports when styling changes.

---

## 15. Verification and definition of done

### 15.1 Command sequence

On a **clean checkout**, build workspace outputs first, because packages resolve through `dist`:

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm lint
pnpm verify:explicit-any
pnpm typecheck
pnpm test
pnpm verify:package-exports
pnpm test:security
pnpm test:a11y
pnpm test:roundtrip
pnpm test:e2e
pnpm audit --prod
```

Confirm each script exists in `package.json`; if one is missing or renamed, say so and use the closest real equivalent. Run the full sequence for release-affecting or cross-package changes; for small, isolated changes run the relevant subset **plus** build, lint, typecheck, and the tests of every impacted package, and state exactly what you skipped.

### 15.2 Definition of done checklist

- [ ] Scope matches the task; any expansion was explained and approved.
- [ ] No content-loss path introduced; legacy and unknown nodes preserved.
- [ ] Regression test(s) added and **observed to fail before / pass after** where practical.
- [ ] No new explicit `any`, `@ts-ignore`, unsafe type assertions, swallowed errors, or dead controls.
- [ ] Security impact assessed; XSS tests added for any new HTML surface.
- [ ] Accessibility checked (names, focus, keyboard); RTL and mixed text checked for UI changes.
- [ ] Public API changes are additive, documented, and tested; export verification passes.
- [ ] Docs, playground examples, and fixtures updated as needed.
- [ ] Commands run and **exact outcomes** reported, including the CI run and SHA if available.

### 15.3 Honest reporting

- If you could not verify something, write exactly: `Not verified: [item]. How to verify: [command]`.
- **Never** claim production readiness, "fully secure", or a numerical quality score without independent evidence.
- Never paste invented test output. If a command failed, report the failure and what you did about it.
- Distinguish **implemented** features from **proposals** and from **legacy documentation claims**.

---

## 16. Priorities and scope control

| Priority | Examples |
| --- | --- |
| **P0** | Content loss; XSS or other security flaws; schema/compatibility breaks; broken editor or save behavior |
| **P1** | Cards and media reliability; rendering and import/export correctness; host parity; accessibility and RTL; package integrity |
| **P2** | Polish, ergonomics, and benchmark-inspired enhancements |

- Work top-down. Do not spend time on P2 while an open P0/P1 in the same area is unaddressed unless the owner asks.
- **Scope expansion** (new package, new dependency, schema change, host-side behavior, UI redesign) MUST be explained before proceeding.
- Prefer **targeted, reversible edits** over rewrites. If a rewrite seems necessary, propose it with evidence and a migration path.

---

## 17. Task playbooks

### 17.1 Bug fix
1. Reproduce (test or playground steps). 2. Find the root cause in source. 3. Write the failing regression test. 4. Make the smallest correct fix. 5. Check neighboring paths (import, export, render, paste, RTL). 6. Verify and report.

### 17.2 New card
Follow §11.1 end to end. Start from the Zod contract and the safe renderer, then the editor UI. Include XSS tests and a fallback for HTML/Markdown export.

### 17.3 New or changed editor interaction (toolbar, menu, shortcut)
Define the command, wire it to the model, ensure serialization, add keyboard + accessible name, test undo/redo and read-only, add e2e coverage for the flow.

### 17.4 Serialization, schema, or migration change
Follow §6.4–6.5. Establish a baseline round-trip first. Treat as P0. Obtain approval before bumping versions.

### 17.5 Import/export (HTML/Markdown) change
Add fixtures from real-world sources (Word, Google Docs, web, other editors). Verify sanitization, direction, tables, links, images, captions. Document lossy behavior.

### 17.6 Media upload flow change
Model it as a state machine (idle → uploading → success/failure/cancelled). Test cancellation, retry, partial success, card removal mid-upload, and edits during upload. Never persist temporary URLs.

### 17.7 Plugin SDK change
Keep it additive; document extension points; test registration conflicts; re-verify that plugin output is sanitized.

### 17.8 Dependency change
Justify the need, review license/security/bundle impact and peer ranges, check Lexical/React compatibility, update the lockfile cleanly, run the full verification sequence including `pnpm audit --prod`. No major upgrades without approval.

### 17.9 Host synchronization
Confirm ADR-0001 status and the exact host SHA. Diff behavior, not just code. Do not copy files wholesale; port minimal changes with tests. Record the SHA in the PR.

### 17.10 Documentation change
Verify every claim against source; remove or flag stale statements; mark proposals as proposals; keep examples runnable in the playground.

### 17.11 UI/visual change
Use tokens, test light/dark and responsive layouts, check RTL, verify focus and contrast, confirm editor/preview fidelity. Include before/after screenshots in the PR when possible.

---

## 18. Code quality rules

- TypeScript **strict**. No new explicit `any`, no `@ts-ignore`/`@ts-expect-error` without a linked justification and a test, no unsafe `as` assertions that bypass validation.
- **Validate at boundaries** (Zod), then trust types internally. Do not scatter defensive checks that hide bugs.
- **Handle errors explicitly**: surface them to the host/user appropriately; never swallow with empty `catch`.
- No dead code, commented-out blocks, unused exports, or TODOs without an owner/issue.
- Small functions, clear names, pure helpers where possible; side effects isolated in editor/React layers.
- Comments explain **why**, not what. Public APIs have TSDoc with examples.
- No `console.log` debugging left in shipped code; no logging of document content.
- Follow existing formatting and lint rules; do not reformat unrelated files.
- Do not leave the repository in a state where `pnpm build` fails.

---

## 19. Reporting format

**For implementation work**, respond concisely with:

1. **Goal** — what the task set out to do.
2. **Lead Role** — which specialist hat led, and why.
3. **Acceptance Criteria** — testable conditions for success.
4. **Files Changed** — paths with one-line purposes.
5. **Key Decisions** — important choices and alternatives rejected.
6. **Verification** — commands run with exact outcomes (and CI SHA if relevant); anything not verified using the `Not verified:` format.
7. **Security/Compatibility Impact** — document integrity, schema, public API, XSS surface, host parity.
8. **Risks / Next Step** — remaining risks and the recommended follow-up.

**For planning work**, give a brief, evidence-based plan: what you inspected, findings, proposed steps, risks, and open questions.

**Working loop:** inspect → plan briefly → edit real files → verify → report accurately.

---

## 20. Anti-patterns (do not do these)

- Declaring success without running the commands.
- "Fixing" a failing test by weakening it.
- Adding a toolbar button that only changes DOM styling and is lost on save.
- Persisting `blob:`/object URLs or base64 media in documents.
- Sanitizing with a regex, or sanitizing on input but not on output.
- Importing from another package's private path "just this once".
- Importing React/Lexical into a server-safe package.
- Remounting the editor on every save or value change.
- Silently dropping unknown nodes or unsupported cards.
- Building persistence, auth, or an AI gateway inside Studio.
- Copying code, icons, or copy text from another editor or from the host repo without a license and compatibility review.
- Claiming "works like Gutenberg/Ghost/Wix" or a numeric quality score without evidence.
- Large mixed-purpose PRs (feature + refactor + dependency bump).
- Absolute positioning or fixed pixel layouts in content.
- Using physical `left/right` CSS where logical properties are needed.

---

## 21. When to stop and ask

Pause and request direction (with a concise summary of options and your recommendation) when:

- The task requires a **schema version bump** or any change that could alter how existing documents load.
- A change would **break a public API**, export contract, or CSS contract.
- You discover a **security issue** (stop, minimize detail in public channels, report privately to the owner, fix with the owner's guidance).
- Source, docs, and host reference **disagree** in a way you cannot resolve with evidence.
- The task would move **host responsibilities** into Studio, or Studio responsibilities into the host.
- A new dependency, major upgrade, or new package seems necessary.
- You cannot reproduce the problem or run the verification commands in your environment.

---

## 22. Glossary

- **Card** — a serializable, rich content block (image, gallery, callout, embed, and so on) with a Zod contract, editor UI, and safe renderer.
- **Host** — the application embedding Studio (initially the Vibress CMS) that owns auth, persistence, storage, and AI access.
- **Forward-compatible node** — a node type unknown to the current version, preserved verbatim through load/save.
- **Round-trip** — converting content out and back in (save/reload, export/import) without loss.
- **Server-safe package** — a package with no React, Lexical, or browser-only dependencies, usable in server rendering.
- **Allowlist sanitizer** — a sanitizer that permits only explicitly approved elements, attributes, and URL schemes.
- **ADR** — Architecture Decision Record (for example `docs/adr/0001-studio-canonical-runtime.md`).
- **Benchmark editor** — a mature external editor (Gutenberg, Koenig, Notion, Medium, Wix/Squarespace) used strictly as a UX reference.

---

*Keep this file honest: when you find it out of date, propose an update in the same PR that proves the correction.*
