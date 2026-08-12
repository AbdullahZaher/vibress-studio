# Vibress Studio — 10/10 Production Hardening Prompt

You are working inside the `vibress-studio` repository.

## Objective

Take Vibress Studio from a good MVP/editor foundation to a **production-grade 10/10 CMS editor package**.

Current assessed state:

```text
VIBRESS STUDIO: GOOD FOUNDATION, NOT PRODUCTION READY
Estimated score: ~6.6/10
```

Primary weaknesses to fix:

```text
1. Unsafe HTML rendering and weak sanitizer.
2. URL/attribute injection risk.
3. `dangerouslySetInnerHTML` usage without strong guarantees.
4. Media cards use temporary object URLs instead of a real upload adapter.
5. Slash menu and bookmark URL parsing can crash.
6. Import/export roundtrip is limited.
7. Markdown export does not cover cards deeply.
8. Packaging still points to src instead of dist.
9. Lexical runtime concerns are mixed with card definition packages.
10. Test coverage is not strong enough for production editor/security claims.
```

Do **not** add unrelated features.  
Do **not** rewrite the architecture from scratch.  
Do **not** claim production readiness unless verified by tests and runtime evidence.

---

# Required Final Verdict Format

At the end, return exactly:

```text
# VIBRESS STUDIO 10/10 HARDENING RESULT

## EXECUTIVE SUMMARY
overall status:
final verdict:
final score:
branch:
final SHA:
working tree clean:
files changed:
tests:
E2E:
security:
release blockers:

## PHASE RESULTS
P0 Security:
P1 Renderer safety:
P2 Editor robustness:
P3 Media integration:
P4 Import/export:
P5 Packaging:
P6 Testing:
P7 Documentation:
P8 Final verification:

## QUALITY GATES
pnpm install --frozen-lockfile:
pnpm lint:
pnpm typecheck:
pnpm test:
pnpm build:
pnpm audit --prod:
security regression tests:
XSS regression tests:
accessibility tests:
package exports validation:
bundle/package smoke:
example app smoke:

## REMAINING TECHNICAL DEBT
For each item:
item:
severity:
production impact:
why accepted:
future action:

## BLOCKERS
If none:
None.

## FINAL VERDICT
Use exactly one:

VIBRESS STUDIO: PRODUCTION READY

or:

VIBRESS STUDIO: READY WITH ACCEPTED TECHNICAL DEBT

or:

VIBRESS STUDIO: NOT READY
```

Do not use `PRODUCTION READY` if raw HTML cards, unsafe URL interpolation, failing XSS tests, broken package exports, or missing core editor flows remain.

---

# Program Rules

## Non-negotiable rules

1. Security fixes come first.
2. Never render user-controlled HTML without a real allowlist sanitizer.
3. Never interpolate URLs or attributes into HTML without attribute escaping.
4. Never rely on regex-only HTML sanitization for production.
5. Do not leave `dangerouslySetInnerHTML` unless the input is sanitized and tested.
6. Do not use `any` in production source.
7. Do not point package `main` / `types` to `src` for publishable packages.
8. Do not claim 10/10 without evidence.
9. Add tests before or with fixes.
10. Every phase gets its own commit.
11. Keep public APIs documented.
12. Preserve existing architecture where practical.

## Branch and commit strategy

Start from latest main:

```bash
git checkout main
git pull origin main
git checkout -b hardening/studio-production-readiness
```

Each phase must be committed separately:

```bash
git add .
git commit -m "hardening(P0): secure html and url rendering"
git commit -m "hardening(P1): harden studio renderers"
git commit -m "hardening(P2): make editor interactions robust"
...
```

Do not merge until all quality gates pass.

---

# Phase P0 — Security Baseline and Threat Model

## Goal

Create a production-grade threat model for Vibress Studio and fix the most dangerous security issues first.

## Required work

Create:

```text
docs/security/threat-model.md
docs/security/xss-regression-matrix.md
```

Document attack surfaces:

```text
HTML card
Embed card
Bookmark card
Image/video/audio/file cards
Markdown import/export
HTML import/export
React preview rendering
Server-side HTML rendering
Plugin-provided cards
Card attributes
URLs
Inline styles/classes
captions/alt text/titles
```

Classify each field as:

```text
plain text
URL
HTML
Markdown
JSON data
trusted system value
untrusted user value
```

For each renderer, document:

```text
input source
sanitization layer
escaping layer
allowed tags
allowed attributes
allowed protocols
test coverage
```

## Required tests

Add a security test file:

```text
packages/studio-testing/security/xss-payloads.test.ts
```

Include payloads:

```html
<script>alert(1)</script>
<img src=x onerror=alert(1)>
<svg onload=alert(1)>
<iframe srcdoc="<script>alert(1)</script>"></iframe>
<a href="javascript:alert(1)">x</a>
<img src="https://example.com&quot; onerror=&quot;alert(1)">
<div style="background:url(javascript:alert(1))">
<math href="javascript:alert(1)">
<form action="https://evil.example">
<object data="https://evil.example/x.swf"></object>
```

Acceptance:

```text
XSS matrix documented: PASS
dangerous payloads blocked or escaped: PASS
all security tests pass: PASS
```

Commit:

```bash
git add .
git commit -m "hardening(P0): add studio security threat model and xss matrix"
```

---

# Phase P1 — Replace Regex Sanitization With Production Sanitizer

## Problem

Regex-only HTML sanitization is not production-safe.

## Goal

Use a real allowlist sanitizer.

## Required implementation

Choose one:

```text
Option A: sanitize-html
Option B: DOMPurify with jsdom/server-compatible setup
```

Prefer `sanitize-html` for Node/server rendering unless there is a strong reason otherwise.

Create:

```text
packages/studio-html/src/sanitize/
  sanitize-html.ts
  sanitize-url.ts
  escape-html.ts
  escape-attribute.ts
  policy.ts
```

## Required sanitizer policy

Use explicit allowlist.

Recommended allowed tags:

```text
p, br, strong, em, s, u, code, pre, blockquote,
ul, ol, li,
h1, h2, h3, h4,
a,
img,
figure, figcaption,
hr,
span
```

Allowed attributes:

```text
a: href, title, target, rel
img: src, alt, title, width, height, loading, decoding
span: class
code: class
pre: class
figure: class
figcaption: class
```

Disallow:

```text
script
iframe
object
embed
form
input
button unless specifically generated by trusted button renderer
svg
math
style attributes
event handler attributes
srcdoc
javascript:
vbscript:
data:text/html
data:image/svg+xml
```

Allowed URL protocols:

```text
http:
https:
mailto:
tel:
```

For image sources, allow only:

```text
http:
https:
data:image/png
data:image/jpeg
data:image/gif
data:image/webp
blob:
```

Do not allow `data:image/svg+xml` unless a separate sanitizer exists for SVG.

## Required changes

Replace all previous regex sanitizer usage.

Ensure all HTML output goes through:

```text
sanitizeHtml for HTML fragments
escapeHtml for text nodes
escapeAttribute for attributes
sanitizeUrl + escapeAttribute for URL attributes
```

## Acceptance

```text
regex-only sanitizer removed: PASS
allowlist sanitizer implemented: PASS
dangerous tags removed: PASS
event attributes removed: PASS
URL protocols enforced: PASS
attribute escaping enforced: PASS
XSS tests pass: PASS
```

Commit:

```bash
git add .
git commit -m "hardening(P1): replace regex sanitizer with allowlist html policy"
```

---

# Phase P2 — Secure Card Rendering

## Goal

Every built-in card renderer must be safe by default.

## Required work

Audit and fix renderers for:

```text
image
gallery
video
audio
file
bookmark
embed
button
callout
toggle
markdown
html
divider
```

## HTML card policy

The HTML card is the highest-risk card.

Choose one of these policies:

### Option A — Disable raw HTML card by default

Raw HTML card may exist only behind explicit configuration:

```ts
allowRawHtmlCard: false
```

When disabled:

```text
Editor shows placeholder/warning.
Public renderer does not emit raw HTML.
```

### Option B — Sanitize HTML card strictly

`HtmlCardDefinition.renderHtml` must return sanitized HTML only.

Raw HTML is never emitted.

### Option C — Trusted-only raw HTML

Raw HTML card requires:

```text
trusted author role
server-side permission check
audit log
visible warning in editor
strict CSP compatibility check
```

For 10/10, choose **Option B + optional trusted override disabled by default**.

## Required renderer rules

### Image card

- sanitize URL.
- escape `alt`, `caption`, `title`.
- prevent attribute injection.
- validate width/height as numbers.
- reject SVG data URLs.
- support lazy loading safely.

### Gallery card

- sanitize every image.
- reject invalid items.
- avoid rendering broken attributes.
- escape captions.

### Video/audio cards

- sanitize media URL.
- support safe attributes only.
- no autoplay unless explicitly configured.
- no inline event attributes.
- optional poster URL sanitized.

### File card

- sanitize URL.
- escape filename.
- never render executable inline.
- use download attribute safely.
- no dangerous protocols.

### Bookmark card

- parse URL safely with try/catch.
- sanitize and escape all fields.
- no crash on malformed URL.
- SSR-safe output.

### Embed card

- do not allow arbitrary iframe HTML by default.
- support provider allowlist.
- sanitize provider URLs.
- render unsupported embeds as safe links/placeholders.
- no `srcdoc`.
- no arbitrary script.

### Button card

- sanitize href.
- escape label.
- prevent style/class injection.
- require safe target/rel behavior.

### Markdown card

- markdown to HTML must be sanitized after conversion.
- code blocks escaped.
- links sanitized.

### Callout/toggle

- escape text.
- sanitize nested content if any.
- no raw HTML injection.

## Acceptance

```text
all built-in cards safe by default: PASS
HTML card sanitized: PASS
embed card provider allowlist: PASS
no URL attribute injection: PASS
malformed URLs do not crash: PASS
renderer tests pass: PASS
```

Commit:

```bash
git add .
git commit -m "hardening(P2): secure all built-in card renderers"
```

---

# Phase P3 — Remove Unsafe React Preview Paths

## Problem

React preview/editor paths use `dangerouslySetInnerHTML`.

## Goal

Keep `dangerouslySetInnerHTML` only in tiny audited components that receive sanitized HTML.

## Required work

Create:

```text
packages/studio-react/src/security/SafeHtml.tsx
```

Example contract:

```ts
type SanitizedHtml = {
  __brand: 'SanitizedHtml';
  html: string;
};
```

Only sanitizer functions can create `SanitizedHtml`.

`SafeHtml` accepts only `SanitizedHtml`.

Replace direct `dangerouslySetInnerHTML` usage with:

```tsx
<SafeHtml html={sanitizedHtml} />
```

If any raw usage remains, document why and add a test.

## Required tests

- React preview renders sanitized HTML.
- Raw script does not execute/render.
- Dangerous attributes removed.
- HTML card preview uses sanitizer.
- Embed preview does not inject iframe unless provider is allowed.

## Acceptance

```text
direct dangerous React HTML usage removed: PASS
SafeHtml boundary exists: PASS
sanitized branded type exists: PASS
React security tests pass: PASS
```

Commit:

```bash
git add .
git commit -m "hardening(P3): add safe html boundary for react previews"
```

---

# Phase P4 — Editor Robustness and UX Completion

## Goal

Make the editor stable under normal user input and malformed data.

## Required fixes

### Slash menu

Fix regex construction.

Do not do:

```ts
new RegExp(queryString, 'i')
```

without escaping.

Implement:

```ts
escapeRegExp(queryString)
```

Tests:

```text
query "[": does not crash
query "(": does not crash
query "*": does not crash
query "image": filters correctly
empty query shows defaults
keyboard navigation works
```

### Bookmark editor

Wrap URL parsing:

```ts
try {
  new URL(url)
} catch {
  show validation state
}
```

Do not crash on malformed URLs.

### Card editors

For all card editors:

```text
invalid URL shows validation message
empty required field handled
keyboard accessible
labels use htmlFor
aria-describedby on errors
focus handling works
undo/redo does not corrupt card data
```

### Error boundary

Add editor-level error boundary:

```text
card editor crash does not crash entire editor
fallback allows removing broken card
error logged safely
```

## Acceptance

```text
slash menu robust: PASS
bookmark malformed URL safe: PASS
card editor validation: PASS
editor error boundary: PASS
keyboard basics: PASS
```

Commit:

```bash
git add .
git commit -m "hardening(P4): improve editor robustness and validation"
```

---

# Phase P5 — Media Upload Adapter and Asset Persistence

## Problem

Media cards rely on temporary `URL.createObjectURL(file)` previews.

## Goal

Introduce a real upload adapter contract while preserving local preview support.

## Required design

Create:

```text
packages/studio-core/src/media/upload-adapter.ts
```

Interface:

```ts
export interface StudioUploadAdapter {
  upload(file: File, context: StudioUploadContext): Promise<StudioUploadedAsset>;
  abort?(uploadId: string): Promise<void>;
}
```

Types:

```ts
StudioUploadedAsset {
  id: string;
  url: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
  alt?: string;
  caption?: string;
}
```

Support:

```text
progress
abort
error state
retry
file type validation
file size validation
image dimensions
video/audio metadata where feasible
temporary preview URL cleanup via URL.revokeObjectURL
```

Create adapter examples:

```text
MemoryUploadAdapter for tests
VibressMediaUploadAdapter for API integration
```

Do not hardcode Vibress API in core packages.

## Acceptance

```text
upload adapter contract exists: PASS
media card stores persisted asset metadata: PASS
temporary object URLs revoked: PASS
progress/error states: PASS
file validation: PASS
tests pass: PASS
```

Commit:

```bash
git add .
git commit -m "hardening(P5): add media upload adapter and persisted asset flow"
```

---

# Phase P6 — Import / Export Roundtrip

## Goal

Make Studio document import/export trustworthy.

## HTML import

Improve `htmlToStudioDocument`.

Do not rely on fragile regex for production.

Use a real parser:

```text
parse5
htmlparser2
rehype
```

Preserve:

```text
paragraphs
headings
bold/italic/strike/code
links
blockquotes
ordered/unordered lists
code blocks
images
figures/captions
horizontal rules
safe embeds as placeholders
```

Sanitize before or during import.

## Markdown import/export

Support:

```text
paragraphs
headings
bold/italic/strike/code
links
blockquotes
lists
code blocks
images
horizontal rules
supported cards using deterministic custom syntax
```

For unsupported cards, export structured fallback:

```md
::vibress-card{type="gallery"}
{...json...}
::
```

or another documented deterministic format.

## Roundtrip tests

Add tests:

```text
HTML → Studio → HTML
Markdown → Studio → Markdown
Studio → HTML → Studio
Studio → Markdown → Studio
malicious HTML import sanitized
malicious markdown links sanitized
cards survive roundtrip
unsupported cards degrade safely
```

## Acceptance

```text
regex-only HTML import removed: PASS
HTML parser used: PASS
markdown roundtrip improved: PASS
cards have deterministic fallback: PASS
roundtrip tests pass: PASS
```

Commit:

```bash
git add .
git commit -m "hardening(P6): improve import export and roundtrip fidelity"
```

---

# Phase P7 — Package Architecture and Publish Readiness

## Problem

Packages currently point to `src` and some boundaries mix runtime concerns.

## Goal

Make packages publishable and cleanly layered.

## Required package exports

For every package:

```json
{
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "README.md", "LICENSE"]
}
```

If using ESM-only, make it explicit.

## Required build output

- Build to `dist`.
- Do not emit JS inside `src`.
- Type declarations generated.
- Package exports tested.

## Boundary cleanup

Avoid forcing server/render packages to import Lexical/React.

Target layering:

```text
studio-core
  schema, document model, validation, migrations, upload contracts

studio-cards
  serializable card definitions and schemas only

studio-renderer
  safe HTML/plain-text rendering

studio-html
  sanitize/import/export HTML utilities

studio-markdown
  markdown import/export utilities

studio-react
  React editor and preview components

studio-lexical or studio-react/nodes
  Lexical-specific nodes/plugins

studio-plugin-sdk
  plugin APIs

studio-testing
  fixtures and test utilities
```

If separating Lexical nodes into a new package is too large, at minimum ensure server renderers do not import Lexical accidentally.

## Required checks

Add script:

```bash
pnpm verify:package-exports
```

It should verify:

```text
all package exports point to dist
dist files exist after build
types exist
no src main/types for publishable packages
no React/Lexical import in server renderer packages
```

## Acceptance

```text
packages export dist: PASS
declarations generated: PASS
server packages do not import React/Lexical: PASS
package smoke tests pass: PASS
```

Commit:

```bash
git add .
git commit -m "hardening(P7): make studio packages publish-ready"
```

---

# Phase P8 — Plugin SDK and Extension Safety

## Goal

Make third-party Studio plugins safe and predictable.

## Required work

Define plugin API:

```text
registerCard
registerRenderer
registerToolbarAction
registerSlashCommand
registerUploadProvider
```

Security requirements:

```text
plugin renderers must declare trust level
plugin card schemas validated with Zod or equivalent
plugin HTML output sanitized by host unless explicitly trusted
plugin permissions/capabilities declared
unsafe capabilities disabled by default
```

Plugin manifest:

```ts
interface StudioPluginManifest {
  id: string;
  name: string;
  version: string;
  capabilities: StudioPluginCapability[];
}
```

Capabilities:

```text
render-html
raw-html
upload
external-embed
toolbar-command
slash-command
```

Add plugin isolation tests:

```text
plugin cannot bypass sanitizer by default
plugin raw-html denied without capability
invalid plugin manifest rejected
duplicate card IDs rejected
malicious plugin renderer sanitized
```

## Acceptance

```text
plugin SDK typed: PASS
capability model exists: PASS
host sanitizes plugin output: PASS
plugin safety tests pass: PASS
```

Commit:

```bash
git add .
git commit -m "hardening(P8): add safe plugin capability model"
```

---

# Phase P9 — Accessibility and Editor Quality

## Goal

Make Studio usable and accessible enough for production CMS authors.

## Required work

Audit and fix:

```text
labels
aria-describedby
keyboard navigation
focus trap in dialogs
slash menu keyboard controls
toolbar buttons
card selection
card movement
error announcements
screen-reader labels
color contrast
disabled/loading states
```

Add tests:

```text
axe accessibility smoke
keyboard navigation
slash menu navigation
card editor labels
focus restore after closing menus/dialogs
```

## Acceptance

```text
axe smoke passes: PASS
keyboard navigation passes: PASS
form labels accessible: PASS
focus behavior tested: PASS
```

Commit:

```bash
git add .
git commit -m "hardening(P9): improve editor accessibility and keyboard flows"
```

---

# Phase P10 — Test Coverage Expansion

## Goal

Raise test coverage from MVP-level to production confidence.

## Required test categories

Add tests for:

```text
security/XSS
URL sanitization
HTML sanitization policy
all card renderers
React preview safety
slash menu behavior
bookmark invalid URLs
media upload success/failure/abort
import/export roundtrip
plugin safety
package exports
accessibility
migration compatibility
large document performance
malformed document recovery
```

## Performance tests

Add benchmark-style tests or scripts for:

```text
render 1,000 paragraphs
render 500 cards
import large HTML document
export large Markdown document
editor initial load with large document
```

The benchmark does not need to be strict CI-failing unless thresholds are stable, but it must report numbers.

## Acceptance

```text
coverage materially expanded: PASS
security regressions covered: PASS
large document behavior measured: PASS
all tests pass: PASS
```

Commit:

```bash
git add .
git commit -m "hardening(P10): expand studio production test coverage"
```

---

# Phase P11 — Documentation and Integration Guides

## Goal

Make adoption by Vibress core and future plugin authors straightforward.

## Required docs

Create or update:

```text
README.md
docs/architecture.md
docs/security.md
docs/sanitization-policy.md
docs/cards.md
docs/import-export.md
docs/media-upload-adapter.md
docs/plugin-sdk.md
docs/package-exports.md
docs/testing.md
docs/vibress-integration.md
docs/production-readiness.md
```

Required content:

```text
how to install
how to build
how to use editor
how to render public HTML safely
how to configure sanitizer policy
how to implement upload adapter
how to add custom cards
how to write safe plugins
how to import/export
security guarantees
known limitations
browser support
versioning policy
```

## Acceptance

```text
docs complete: PASS
security model documented: PASS
plugin author guide: PASS
Vibress integration guide: PASS
```

Commit:

```bash
git add .
git commit -m "hardening(P11): document studio security integration and plugin APIs"
```

---

# Phase P12 — Final Quality Gates

## Required commands

Run:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit --prod
```

Also run:

```bash
pnpm verify:explicit-any
pnpm verify:package-exports
pnpm test:security
pnpm test:a11y
pnpm test:roundtrip
```

If scripts do not exist, create them.

## Required final checks

```text
No explicit any in production source.
No regex-only HTML sanitizer.
No raw HTML card output.
No unsafe URL attribute interpolation.
No direct dangerouslySetInnerHTML outside SafeHtml.
No server renderer imports React/Lexical.
Package exports point to dist.
Security tests pass.
Accessibility tests pass.
Import/export tests pass.
Build output clean.
Working tree clean.
```

## Required score conditions

Only claim 10/10 if all are true:

```text
HTML rendering security: PASS
URL/attribute escaping: PASS
React preview safety: PASS
All built-in cards secure: PASS
Media upload adapter: PASS
Import/export roundtrip: PASS
Publishable packages: PASS
Plugin safety model: PASS
Accessibility baseline: PASS
Security tests: PASS
A11y tests: PASS
Package exports tests: PASS
Docs complete: PASS
No release blockers: PASS
```

If any item remains incomplete, use:

```text
READY WITH ACCEPTED TECHNICAL DEBT
```

or:

```text
NOT READY
```

Commit final evidence:

```bash
git add .
git commit -m "hardening(P12): record final studio production verification"
```

---

# Target Commit List

Expected commit sequence:

```text
hardening(P0): add studio security threat model and xss matrix
hardening(P1): replace regex sanitizer with allowlist html policy
hardening(P2): secure all built-in card renderers
hardening(P3): add safe html boundary for react previews
hardening(P4): improve editor robustness and validation
hardening(P5): add media upload adapter and persisted asset flow
hardening(P6): improve import export and roundtrip fidelity
hardening(P7): make studio packages publish-ready
hardening(P8): add safe plugin capability model
hardening(P9): improve editor accessibility and keyboard flows
hardening(P10): expand studio production test coverage
hardening(P11): document studio security integration and plugin APIs
hardening(P12): record final studio production verification
```

---

# Final Merge Instructions

After all phases pass:

```bash
git status --short
git log --oneline --decorate -n 30
```

If clean:

```bash
git checkout main
git pull origin main
git merge --no-ff hardening/studio-production-readiness -m "merge: studio production hardening"
```

Run final gates again from main:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm audit --prod
```

Then push:

```bash
git push origin main
```

If main is protected:

```bash
git push origin hardening/studio-production-readiness
gh pr create \
  --base main \
  --head hardening/studio-production-readiness \
  --title "Studio production hardening" \
  --body "Hardens Vibress Studio to production readiness with security, package, plugin, import/export, accessibility, and verification phases."
```

---

# Final Expected Standard

The final 10/10 state means:

```text
Vibress Studio can safely edit, store, render, import, export, extend, package, and integrate rich CMS content without exposing users to avoidable XSS, broken package boundaries, fragile editor crashes, or unverified production claims.
```

Do not optimize for the score number.  
Optimize for evidence-backed safety and correctness.
