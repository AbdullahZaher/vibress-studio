# Vibress Studio — Plugin SDK

`@vibress/studio-plugin-sdk` provides an in-process extension model for Vibress Studio. Plugins can register custom card types with runtime schema validation, HTML rendering, plain-text export, and slash-menu discovery.

## Architecture and Execution Model

> [!IMPORTANT]
> **No Sandboxing:** Plugins execute in-process within the host application's JavaScript runtime. They are **not isolated** in web workers or iframe sandboxes. Host applications must only install and register trusted plugins.

Security and content integrity are maintained through three structural boundaries:
1. **Collision Prevention:** Plugin card types cannot collide with or shadow built-in Studio cards (`image`, `video`, `gallery`, `audio`, `file`, `bookmark`, `embed`, `button`, `callout`, `toggle`, `markdown`, `html`, `divider`) or cards registered by other plugins.
2. **Schema Validation:** Each card definition specifies a `validate(data)` function (typically using Zod) that rejects malformed payloads before rendering.
3. **Mandatory Host Sanitization:** Both the public HTML renderer (`renderStudioDocumentToHtml`) and editor canvas (`StudioCardComponent`) sanitize card markup with the shared **parse5-backed allowlist**. Direct consumers use `registry.renderCardHtml()` or `renderStudioCardSafeHtml()`. Calling a definition's `renderHtml()` directly returns untrusted markup and bypasses those helpers.

---

## Plugin Contract

A plugin implements the `StudioPlugin` interface:

```ts
import type { StudioPlugin } from '@vibress/studio-plugin-sdk';
import type { StudioCardDefinition } from '@vibress/studio-card-definitions';

export interface StudioPlugin {
  name: string;
  version: string;
  apiVersion?: number; // defaults to supported API v1
  cards?: StudioCardDefinition[];
  toolbarItems?: StudioToolbarItem[];
}
```

API v1 supports custom cards, validation, slash-menu discovery, sanitized HTML
and plain-text rendering. `toolbarItems` is reserved metadata: Studio does not
mount those controls or execute them. There is no public command-contribution
API, dynamic registry subscription or plugin sandbox.

Registration validates the runtime contract before mutating the registry and
accepts `apiVersion: 1` or an omitted version. Unsupported API versions throw
`StudioPluginError` with `UNSUPPORTED_API_VERSION`; malformed definitions use
`INVALID_PLUGIN`. Definitions are copied at registration, and plugin lists are
returned as snapshots, so changing caller-owned arrays cannot alter ownership.
Use `unregisterPlugin(name)` before deliberate re-registration. Configure the
registry before mounting Studio; unregistering does not rewrite persisted cards.

`renderCardHtml()` returns `null` for an unregistered card and throws a redacted
`StudioPluginError('RENDER_FAILED')` for validation/rendering failures. The
document renderer isolates per-card failures. API changes remain additive within
v1; incompatible capabilities need a new API version and a documented migration.
Existing API versions are not removed without a deprecation notice and a major
package release.

### Card Definition

A card definition implements `StudioCardDefinition`:

```ts
import { z } from 'zod';
import { escapeHtml } from '@vibress/studio-utils';
import type { StudioCardDefinition } from '@vibress/studio-card-definitions';

const MetricCardSchema = z.object({
  label: z.string(),
  value: z.number(),
  change: z.string().optional(),
});

type MetricCardData = z.infer<typeof MetricCardSchema>;

export const MetricCardDefinition: StudioCardDefinition<MetricCardData> = {
  type: 'metric-card',
  version: 1,
  title: 'Metric Card',
  description: 'Display a KPI with trend indicator',
  validate: (data: unknown) => MetricCardSchema.parse(data),
  renderHtml: (data: MetricCardData) => {
    return `<div class="studio-metric-card">
      <span class="studio-metric-label">${escapeHtml(data.label)}</span>
      <span class="studio-metric-value">${data.value}</span>
    </div>`;
  },
  renderPlainText: (data: MetricCardData) => `${data.label}: ${data.value}`,
};
```

---

## Registry Usage

### 1. Creating the Registry

```ts
import { StudioPluginRegistry } from '@vibress/studio-plugin-sdk';

const registry = new StudioPluginRegistry();

registry.registerPlugin({
  name: 'analytics-widgets',
  version: '1.0.0',
  cards: [MetricCardDefinition],
});
```

### 2. Preflight Collision Checks

Registration performs an atomic preflight check:
- If `plugin.name` is already registered, registration is a safe no-op (idempotent).
- If any card type matches a built-in card or an already registered plugin card, registration throws `Error('STUDIO_CARD_TYPE_CONFLICT: <type>')`.
- If a plugin has multiple cards and any one fails, **no cards** from that plugin are registered (atomic failure).

### 3. Editor Integration

Pass the registry to `<VibressStudio />`:

```tsx
import { VibressStudio } from '@vibress/studio-react';
import { registry } from './plugins';

export function Editor({ value, onChange }) {
  return (
    <VibressStudio
      value={value}
      onChange={onChange}
      pluginRegistry={registry}
    />
  );
}
```

Registered plugin cards automatically:
- Appear in the `/` slash menu under the `PLUGIN` badge.
- Are inserted into the document schema as `studio-card` nodes (`cardType: 'metric-card'`).
- Render in the editor canvas using the card's `validate` and `renderHtml` output, protected by `sanitizeStudioHtml`.

### 4. Public Rendering Integration

Pass the registry in `RenderOptions` to publish the document:

```ts
import { renderStudioDocumentToHtml, renderStudioDocumentToPlainText } from '@vibress/studio-renderer';
import { registry } from './plugins';

// HTML rendering with sanitization
const html = renderStudioDocumentToHtml(doc, { pluginRegistry: registry });

// Plain-text rendering for excerpts and search indexing
const text = renderStudioDocumentToPlainText(doc, { pluginRegistry: registry });
```

If a document contains a custom card but no matching plugin is provided in `pluginRegistry`:
- `renderStudioDocumentToHtml` safely drops the unknown card during allowlist sanitization without breaking the document or leaking internal data.
- `renderStudioDocumentToPlainText` safely returns an empty string without throwing.
