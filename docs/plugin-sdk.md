# Vibress Studio — Plugin SDK

`@vibress/studio-plugin-sdk` provides a safe, capability-gated extension
model. Plugins can add cards, renderers, toolbar actions, slash commands,
and upload providers — but unsafe capabilities are **disabled by default**.

## Manifest

Every plugin declares a manifest with an id, name, version, and the
capabilities it wants:

```ts
import type { StudioPlugin } from '@vibress/studio-plugin-sdk';

const plugin: StudioPlugin = {
  manifest: {
    id: 'my-plugin',            // ^[a-z0-9][a-z0-9._-]*$
    name: 'My Plugin',
    version: '1.0.0',           // semver
    capabilities: ['render-html', 'toolbar-command'],
  },
  install(registration) {
    registration.registerCard(card);
    registration.registerToolbarAction({ id: 'x', label: 'X', execute(editor) { /* ... */ } });
  },
};
```

## Capabilities

| Capability | Grants |
|---|---|
| `render-html` | register custom renderers (host always sanitizes output) |
| `raw-html` | allow a `trusted` card to emit HTML without host sanitization |
| `upload` | register an upload provider |
| `external-embed` | (declared intent) external embeds |
| `toolbar-command` | register toolbar actions |
| `slash-command` | register slash commands |

Rules:

- Declaring a capability the host disallows fails registration.
- `raw-html` requires BOTH the capability AND `trustLevel: 'trusted'` on the
  card. Everything else is `host-sanitized` by default.
- Custom renderers registered via `registerRenderer` are always
  host-sanitized — there is no trusted path for them.
- Invalid manifests, duplicate plugin ids, and duplicate card types are
  rejected with `StudioPluginError` (codes `INVALID_MANIFEST`,
  `DUPLICATE_PLUGIN`, `DUPLICATE_CARD`, `CAPABILITY_REQUIRED`,
  `INVALID_UPLOAD_PROVIDER`).

## Host-side registry

```ts
import { StudioPluginRegistry } from '@vibress/studio-plugin-sdk';

const registry = new StudioPluginRegistry({
  // Optionally block capabilities entirely:
  allowedCapabilities: ['render-html', 'slash-command'],
});

registry.registerPlugin(plugin);
```

The registry also rolls back a plugin (removes its manifest) if `install`
throws partway through.

## Writing safe plugins

- Prefer `host-sanitized` cards; you never need `raw-html`.
- Escape/validate inside your own `renderHtml` anyway (defense in depth):
  `escapeHtml` for text, `sanitizeUrl` + `escapeAttribute` for URLs.
- Never attempt to output `<script>`, `iframe`, or event handlers — the
  host strips them and the tests assert this.
- If you genuinely need trusted output, document the trust requirement and
  the audit trail; the default host rejects it.

## Plugin safety tests

`packages/studio-testing/security/plugin-safety.test.ts` verifies:

- plugin cannot bypass the sanitizer by default;
- plugin `raw-html` denied without capability;
- invalid manifest rejected;
- duplicate card ids rejected;
- malicious plugin renderer output sanitized.
