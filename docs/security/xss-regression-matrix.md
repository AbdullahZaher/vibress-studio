# Vibress Studio — XSS Regression Matrix

Every row is a payload that must be **blocked or escaped** by every renderer
path. Columns show the layer that guarantees the property and the test that
covers it.

Layer keys:

- `escape` — `escapeHtml` / `escapeAttribute` (text and attribute escaping).
- `url` — `sanitizeUrl` / `isSafeUrl` protocol enforcement.
- `sanitize` — allowlist HTML sanitizer (`studio-html` policy).
- `policy` — card-level renderer policy (embed allowlist, dimensions as
  numbers, etc.).
- `parser` — HTML import uses a real parser, never regex.

| # | Payload | Escaped as text | URL layer | HTML sanitize | Card policy | Tests |
|---|---|---|---|---|---|---|
| 1 | `<script>alert(1)</script>` | ✅ | – | ✅ removed | – | `xss-payloads`, `sanitize.test`, `renderer-cards` |
| 2 | `<img src=x onerror=alert(1)>` | ✅ | ✅ `src` re-checked | ✅ event attr removed | – | `xss-payloads`, `sanitize.test` |
| 3 | `<svg onload=alert(1)>` | ✅ | – | ✅ tag removed | – | `xss-payloads`, `sanitize.test` |
| 4 | `<iframe srcdoc="<script>alert(1)</script>"></iframe>` | ✅ | – | ✅ tag removed | ✅ embed allowlist only | `xss-payloads`, `embed.test` |
| 5 | `<a href="javascript:alert(1)">x</a>` | ✅ | ✅ `href` blocked | ✅ `href` rewritten/removed | – | `xss-payloads`, `sanitize.test` |
| 6 | `<img src="https://example.com&quot; onerror=&quot;alert(1)">` | – | ✅ protocol check | ✅ attribute parser (no naive regex) | ✅ alt/attr escaping | `sanitize.test`, `renderer-cards` |
| 7 | `<div style="background:url(javascript:alert(1))">` | – | – | ✅ `style` attribute removed | – | `sanitize.test` |
| 8 | `<math href="javascript:alert(1)">` | ✅ | – | ✅ tag removed | – | `sanitize.test` |
| 9 | `<form action="https://evil.example">` | ✅ | – | ✅ tag removed | – | `sanitize.test` |
| 10 | `<object data="https://evil.example/x.swf"></object>` | ✅ | – | ✅ tag removed | – | `sanitize.test` |

## Renderer-path coverage

| Renderer | Payloads covered | Guarantee |
|---|---|---|
| Text node → `renderStudioDocumentToHtml` | 1–5, 8–10 | `escapeHtml` |
| `href`/`src` attributes (link, image, button, file, bookmark) | 5, 6 | `sanitizeUrl` + attribute escaping |
| HTML card | 1–10 | strict allowlist sanitizer (Option B) |
| Embed card | 4, 9 | provider allowlist; no `srcdoc`; no arbitrary iframe |
| Markdown card / import | 1–10 | `html:false` + sanitize-after-convert + link sanitize |
| HTML import | 1–10 | `parse5` + allowlist policy before node mapping |
| React preview (`SafeHtml`) | 1–10 | branded `SanitizedHtml` boundary only |
| Captions (`captionHtml`) | 1, 2, 3, 7 | sanitized before insertion |
| Plugin cards | 1–10 | host sanitizes output; `raw-html` capability off by default |

## Verification status

- [x] P0 — matrix documented, escape/url-layer tests added, attribute-breakout and SVG data URL validation fixed.
- [ ] P1 — regex sanitizer removed; allowlist sanitizer tested for all rows.
- [ ] P2 — every built-in card renderer covered by renderer tests.
- [ ] P3 — React preview covered by `SafeHtml` tests.
- [ ] P10 — full regression suite passes all rows.
