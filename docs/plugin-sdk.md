# Vibress Studio — Plugin SDK (Implemented Surface)

**Source-reviewed:** 2026-11-04 at `packages/studio-plugin-sdk/src/index.ts`. Plugin registration is **not a sandbox** and does not provide a permissions system.

## Implemented plugin interface

```ts
import {
  StudioPluginRegistry,
  type StudioPlugin
} from '@vibress/studio-plugin-sdk';

const registry = new StudioPluginRegistry();

const plugin: StudioPlugin = {
  name: 'example',
  version: '1.0.0',
  cards: [/* existing StudioCardDefinition objects */],
  toolbarItems: [{
    id: 'example.action',
    label: 'Example action',
    execute(editor) {
      // Host/editor integration is responsible for invoking this.
    }
  }]
};

registry.registerPlugin(plugin);
const definition = registry.getCard('example-card-type');
const safeHtml = registry.renderCardHtml('example-card-type', unknownCardData);
```

`cards` contains `StudioCardDefinition` entries from `@vibress/studio-card-definitions`, each defining `type`, validation and rendering functions. `toolbarItems` are registered metadata but this alone does **not** make them appear in the editor UI.

## Actual registration behavior

- A duplicate plugin name is ignored (returns without registration).
- Duplicate card types within one plugin, conflicts with previously registered types, and collisions with built-in card definitions **throw** `STUDIO_CARD_TYPE_CONFLICT`.
- Card registrations are preflight-checked before mutating the registry, preventing partial registration on a card-type error.
- `getCard`, `getPlugins`, and `renderCardHtml` are available.
- `renderCardHtml` validates registered card input and sanitizes renderer output via `renderStudioCardSafeHtml`.

## Not implemented in this version

The old plugin documentation described `manifest`, `install(registration)`, `allowedCapabilities`, `registerRenderer`, `registerUploadProvider`, `StudioPluginError`, and capabilities `raw-html`, `slash-command`, etc. **Those APIs are not in the reviewed source** and should not be used.

The current `VibressStudio` props do not accept a plugin registry and its interactive card mapping is static. A registered card is **not automatically** insertable or editable in the React authoring experience. Enabling this is a proposed additive design task `STU-R13` under the [remediation roadmap](roadmaps/global-ux-quality-roadmap.md#16-current-authoritative-remediation-and-development-plan--2026-11-04), not an available capability.

## Security and extension requirements

- All renderer output is untrusted; validate with the actual Zod card schema and sanitize at the public HTML boundary.
- Plugin execution is arbitrary JavaScript within the host context; do not promise isolation, permission enforcement or safe execution.
- Do not import another workspace package's private paths or use unverified HTML from a custom card in `dangerouslySetInnerHTML`.
- Any future ability to register toolbar actions, slash commands or plugin-provided editor components requires explicit public contracts, host integration, collision behavior, undo/redo, readonly/keyboard/RTL and XSS regression tests.

Current registry tests are at `tests/studio-plugin-registry.test.ts`. No dedicated `packages/studio-testing/security/plugin-safety.test.ts` exists in the reviewed tree.
