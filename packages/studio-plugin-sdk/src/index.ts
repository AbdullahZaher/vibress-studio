import { z } from 'zod';
import { StudioCardDefinition } from '@vibress/studio-cards';
import { sanitizeHtmlFragment } from '@vibress/studio-utils';

/**
 * Plugin capability model. Unsafe capabilities (`raw-html`, `upload`,
 * `external-embed`) are DISABLED by default: a plugin must declare them in
 * its manifest and the host may reject or gate them.
 */
export type StudioPluginCapability =
  | 'render-html'
  | 'raw-html'
  | 'upload'
  | 'external-embed'
  | 'toolbar-command'
  | 'slash-command';

export const ALL_PLUGIN_CAPABILITIES = [
  'render-html',
  'raw-html',
  'upload',
  'external-embed',
  'toolbar-command',
  'slash-command',
] as const;

export interface StudioPluginManifest {
  id: string;
  name: string;
  version: string;
  capabilities: StudioPluginCapability[];
}

const StudioPluginManifestSchema = z.object({
  id: z.string().min(1).max(128).regex(/^[a-z0-9][a-z0-9._-]*$/i, 'invalid plugin id'),
  name: z.string().min(1).max(128),
  version: z.string().regex(/^\d+\.\d+\.\d+/, 'version must be semver'),
  capabilities: z.array(z.enum(ALL_PLUGIN_CAPABILITIES)).default([]),
});

/**
 * Trust level for a plugin card renderer:
 *  - `host-sanitized` (default): output is always passed through the host
 *    allowlist sanitizer. A plugin can never bypass it.
 *  - `trusted`: output is emitted as-is. REQUIRES the `raw-html` capability
 *    AND explicit opt-in from the host. Disabled by default.
 */
export type StudioCardTrustLevel = 'host-sanitized' | 'trusted';

export interface StudioPluginCardDefinition<TData = Record<string, unknown>>
  extends StudioCardDefinition<TData> {
  trustLevel: StudioCardTrustLevel;
}

export interface StudioToolbarItem {
  id: string;
  label: string;
  icon?: string;
  execute(editor: unknown): void;
}

export interface StudioSlashCommand {
  id: string;
  label: string;
  execute(editor: unknown): void;
}

export interface StudioPluginRegistration {
  registerCard(card: StudioPluginCardDefinition): void;
  registerRenderer(cardType: string, renderHtml: (data: Record<string, unknown>) => string): void;
  registerToolbarAction(action: StudioToolbarItem): void;
  registerSlashCommand(command: StudioSlashCommand): void;
  registerUploadProvider(adapter: unknown): void;
}

export interface StudioPlugin {
  manifest: StudioPluginManifest;
  install(registration: StudioPluginRegistration): void;
}

export class StudioPluginError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'StudioPluginError';
    this.code = code;
  }
}

/**
 * Validates a plugin manifest. Throws StudioPluginError for invalid
 * manifests and duplicate plugin ids.
 */
export function validatePluginManifest(manifest: StudioPluginManifest): StudioPluginManifest {
  const result = StudioPluginManifestSchema.safeParse(manifest);
  if (!result.success) {
    throw new StudioPluginError('INVALID_MANIFEST', `INVALID_MANIFEST: ${result.error.message}`);
  }
  return result.data as StudioPluginManifest;
}

export interface StudioPluginRegistryOptions {
  /** Hosts may block unsafe capabilities entirely. */
  allowedCapabilities?: StudioPluginCapability[];
}

/**
 * Host-side plugin registry. Enforces:
 *  - manifest validation (id/version/capabilities)
 *  - duplicate plugin / card id rejection
 *  - capability gating (raw-html / upload / toolbar / slash commands)
 *  - host sanitization of plugin card output unless trusted + raw-html
 */
export class StudioPluginRegistry {
  private plugins: Map<string, StudioPluginManifest> = new Map();
  private cards: Map<string, StudioPluginCardDefinition> = new Map();
  private renderers: Map<string, (data: Record<string, unknown>) => string> = new Map();
  private toolbarActions: Map<string, StudioToolbarItem> = new Map();
  private slashCommands: Map<string, StudioSlashCommand> = new Map();
  private uploadProviders: Set<string> = new Set();
  private readonly allowedCapabilities: ReadonlySet<StudioPluginCapability>;

  constructor(options: StudioPluginRegistryOptions = {}) {
    this.allowedCapabilities = new Set(options.allowedCapabilities ?? ALL_PLUGIN_CAPABILITIES);
  }

  hasCapability(manifest: StudioPluginManifest, capability: StudioPluginCapability): boolean {
    return (
      manifest.capabilities.includes(capability) &&
      this.allowedCapabilities.has(capability)
    );
  }

  registerPlugin(plugin: StudioPlugin): void {
    const manifest = validatePluginManifest(plugin.manifest);

    if (this.plugins.has(manifest.id)) {
      throw new StudioPluginError('DUPLICATE_PLUGIN', `DUPLICATE_PLUGIN: plugin "${manifest.id}" is already registered`);
    }

    // Strict capability allowlist: a plugin may only declare capabilities the
    // host permits. Declaring a blocked capability is a hard error.
    for (const capability of manifest.capabilities) {
      if (!this.allowedCapabilities.has(capability)) {
        throw new StudioPluginError(
          'CAPABILITY_REQUIRED',
          `CAPABILITY_REQUIRED: plugin "${manifest.id}" declares "${capability}" but the host does not allow it`
        );
      }
    }

    this.plugins.set(manifest.id, manifest);

    const registration: StudioPluginRegistration = {
      registerCard: (card) => this.registerCard(manifest, card),
      registerRenderer: (cardType, renderHtml) =>
        this.registerRenderer(manifest, cardType, renderHtml),
      registerToolbarAction: (action) => this.registerToolbarAction(manifest, action),
      registerSlashCommand: (command) => this.registerSlashCommand(manifest, command),
      registerUploadProvider: (adapter) => this.registerUploadProvider(manifest, adapter),
    };

    try {
      plugin.install(registration);
    } catch (err) {
      // Roll back on install failure.
      this.plugins.delete(manifest.id);
      throw err;
    }
  }

  private registerCard(manifest: StudioPluginManifest, card: StudioPluginCardDefinition): void {
    if (this.cards.has(card.type)) {
      throw new StudioPluginError('DUPLICATE_CARD', `DUPLICATE_CARD: card type "${card.type}" is already registered`);
    }
    const trustLevel = card.trustLevel ?? 'host-sanitized';

    if (trustLevel === 'trusted' && !this.hasCapability(manifest, 'raw-html')) {
      throw new StudioPluginError(
        'CAPABILITY_REQUIRED',
        `CAPABILITY_REQUIRED: card "${card.type}" declares trusted rendering but the plugin lacks the "raw-html" capability`
      );
    }

    // Host sanitization: unless the card is explicitly trusted AND the host
    // permits raw-html, wrap renderHtml so output always passes the allowlist.
    const canEmitRaw = trustLevel === 'trusted' && this.hasCapability(manifest, 'raw-html');
    const originalRender = card.renderHtml.bind(card);
    const wrapped: StudioPluginCardDefinition = {
      ...card,
      trustLevel,
      renderHtml: (data) => {
        const out = originalRender(data);
        return canEmitRaw ? out : sanitizeHtmlFragment(out);
      },
    };

    this.cards.set(card.type, wrapped);
  }

  private registerRenderer(
    manifest: StudioPluginManifest,
    cardType: string,
    renderHtml: (data: Record<string, unknown>) => string
  ): void {
    if (!this.hasCapability(manifest, 'render-html')) {
      throw new StudioPluginError(
        'CAPABILITY_REQUIRED',
        `CAPABILITY_REQUIRED: renderer for "${cardType}" requires the "render-html" capability`
      );
    }
    // Custom renderers are ALWAYS host-sanitized (no trusted path for them).
    const wrapped = (data: Record<string, unknown>): string => sanitizeHtmlFragment(renderHtml(data));
    this.renderers.set(cardType, wrapped);
  }

  private registerToolbarAction(manifest: StudioPluginManifest, action: StudioToolbarItem): void {
    if (!this.hasCapability(manifest, 'toolbar-command')) {
      throw new StudioPluginError(
        'CAPABILITY_REQUIRED',
        `CAPABILITY_REQUIRED: toolbar action "${action.id}" requires the "toolbar-command" capability`
      );
    }
    this.toolbarActions.set(action.id, action);
  }

  private registerSlashCommand(manifest: StudioPluginManifest, command: StudioSlashCommand): void {
    if (!this.hasCapability(manifest, 'slash-command')) {
      throw new StudioPluginError(
        'CAPABILITY_REQUIRED',
        `CAPABILITY_REQUIRED: slash command "${command.id}" requires the "slash-command" capability`
      );
    }
    this.slashCommands.set(command.id, command);
  }

  private registerUploadProvider(manifest: StudioPluginManifest, adapter: unknown): void {
    if (!this.hasCapability(manifest, 'upload')) {
      throw new StudioPluginError(
        'CAPABILITY_REQUIRED',
        'CAPABILITY_REQUIRED: upload provider requires the "upload" capability'
      );
    }
    if (!adapter || typeof adapter !== 'object' || typeof (adapter as { upload?: unknown }).upload !== 'function') {
      throw new StudioPluginError('INVALID_UPLOAD_PROVIDER', 'INVALID_UPLOAD_PROVIDER: upload provider must implement upload(file, context, handlers)');
    }
    this.uploadProviders.add(manifest.id);
  }

  getCard(type: string): StudioPluginCardDefinition | undefined {
    return this.cards.get(type);
  }

  getRenderer(cardType: string): ((data: Record<string, unknown>) => string) | undefined {
    return this.renderers.get(cardType);
  }

  getToolbarActions(): StudioToolbarItem[] {
    return Array.from(this.toolbarActions.values());
  }

  getSlashCommands(): StudioSlashCommand[] {
    return Array.from(this.slashCommands.values());
  }

  hasUploadProvider(pluginId: string): boolean {
    return this.uploadProviders.has(pluginId);
  }

  getPlugins(): StudioPluginManifest[] {
    return Array.from(this.plugins.values());
  }
}
