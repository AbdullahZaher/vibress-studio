# Vibress Studio — Sanitization Policy

The single source of truth for the HTML sanitization policy is
`packages/studio-utils/src/sanitize/policy.ts`. This document explains the
policy and how to configure it.

## Why an allowlist?

Sanitization is safest when it starts from **nothing** and adds back only
what is known-safe (allowlist), instead of trying to remove everything
dangerous (denylist). Denylists fail against entity encoding, malformed
markup, new attack vectors, and parser disagreements. Vibress Studio
therefore uses a strict allowlist backed by `sanitize-html` (WHATWG-style
parsing).

## Allowed tags

```
p, br, strong, em, s, u, code, pre, blockquote,
ul, ol, li,
h1, h2, h3, h4,
a, img,
figure, figcaption,
hr, span
```

## Allowed attributes

| Tag | Attributes |
|---|---|
| `a` | `href`, `title`, `target`, `rel` |
| `img` | `src`, `alt`, `title`, `width`, `height`, `loading`, `decoding` |
| `span` | `class` |
| `code` | `class` |
| `pre` | `class` |
| `figure` | `class` |
| `figcaption` | `class` |

Everything else — `style`, `on*` event handlers, `srcdoc`, `background`,
`formaction`, `xmlns*`, `xlink:href` — is stripped.

## Always denied (hard deny, independent of policy edits)

```
script  style  iframe  object  embed  form  input  button
svg  math  link  meta  base  template  frameset  frame  noscript
```

Plus every `on*` attribute, `style`, `srcdoc`, and `data:image/svg+xml`
URLs.

## URL protocols

Allowed schemes:

- `http:`, `https:`, `mailto:`, `tel:`
- relative paths (`/`, `#`)
- `data:image/png|jpeg|gif|webp` (img `src` only)
- `blob:` (img `src` only — local previews)

Rejected: `javascript:`, `vbscript:`, `file:`, `data:text/html`,
`data:image/svg+xml`, and any URL containing attribute-breakout characters
(`" ' < > \` control chars) or their entity forms (`&quot;`, `&#39;`, ...).

## Customizing the policy

For host applications that need a different policy (e.g. a CMS that allows
more tags for a specific trusted feature):

```ts
import { sanitizeHtmlFragment, HTML_SANITIZE_POLICY } from '@vibress/studio-utils';

const myPolicy = {
  ...HTML_SANITIZE_POLICY,
  allowedTags: [...HTML_SANITIZE_POLICY.allowedTags, 'mark'],
};

// sanitize-html options can be derived from the policy object.
```

**Warning**: expanding the allowlist expands the attack surface. Never add
`script`, `iframe`, `svg`, or `style` without a dedicated mitigation, and
keep the hard-deny list intact.

## Round-trip guarantee

Rendered output must be idempotent under `sanitizeHtmlFragment` — i.e.
`sanitizeHtmlFragment(rendererOutput) === rendererOutput`. The renderer
tests assert this property for every built-in card (see
`security/renderer-cards.test.ts`).
