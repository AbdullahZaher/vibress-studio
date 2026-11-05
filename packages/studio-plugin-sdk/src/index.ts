import {
  STUDIO_CARD_DEFINITIONS,
  renderStudioCardSafeHtml,
  type StudioCardDefinition,
} from '@vibress/studio-card-definitions';

export interface StudioPlugin {
  name: string;
  version: string;
  /** Extension API contract. Omission preserves legacy API v1 behavior. */
  apiVersion?: number;
  cards?: StudioCardDefinition[];
  toolbarItems?: StudioToolbarItem[];
}

export const STUDIO_PLUGIN_API_VERSION = 1;

export class StudioPluginError extends Error {
  constructor(readonly code: 'INVALID_PLUGIN' | 'UNSUPPORTED_API_VERSION' | 'RENDER_FAILED') {
    super(`STUDIO_PLUGIN_${code}`);
    this.name = 'StudioPluginError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function assertPlugin(value: unknown): asserts value is StudioPlugin {
  const invalid = () => { throw new StudioPluginError('INVALID_PLUGIN'); };
  if (!isRecord(value)) return invalid();
  if (typeof value.name !== 'string' || !value.name.trim() ||
      typeof value.version !== 'string' || !value.version.trim()) return invalid();
  if (value.apiVersion !== undefined && value.apiVersion !== STUDIO_PLUGIN_API_VERSION) {
    throw new StudioPluginError('UNSUPPORTED_API_VERSION');
  }
  if (value.cards !== undefined) {
    if (!Array.isArray(value.cards)) return invalid();
    for (const card of value.cards) {
      if (!isRecord(card) || typeof card.type !== 'string' || !card.type.trim() ||
          typeof card.version !== 'number' || !Number.isSafeInteger(card.version) || card.version < 1 ||
          typeof card.validate !== 'function' || typeof card.renderHtml !== 'function' || typeof card.renderPlainText !== 'function' ||
          (card.title !== undefined && typeof card.title !== 'string') ||
          (card.description !== undefined && typeof card.description !== 'string')) return invalid();
    }
  }
  if (value.toolbarItems !== undefined) {
    if (!Array.isArray(value.toolbarItems)) return invalid();
    for (const item of value.toolbarItems) {
      if (!isRecord(item) || typeof item.id !== 'string' || !item.id.trim() ||
          typeof item.label !== 'string' || !item.label.trim() || typeof item.execute !== 'function' ||
          (item.icon !== undefined && typeof item.icon !== 'string')) return invalid();
    }
  }
}

function snapshotPlugin(plugin: StudioPlugin): StudioPlugin {
  return {
    ...plugin,
    cards: plugin.cards?.map(card => ({ ...card })),
    toolbarItems: plugin.toolbarItems?.map(item => ({ ...item })),
  };
}

export interface StudioToolbarItem {
  id: string;
  label: string;
  icon?: string;
  execute(editor: unknown): void;
}

export class StudioPluginRegistry {
  private plugins: Map<string, StudioPlugin> = new Map();
  private cards: Map<string, StudioCardDefinition> = new Map();

  registerPlugin(plugin: unknown): void {
    assertPlugin(plugin);
    if (this.plugins.has(plugin.name)) {
      return;
    }
    // Preflight before mutating either registry: a rejected plugin must not
    // leave partial card registrations behind.
    const cardTypes = new Set<string>();
    for (const card of plugin.cards ?? []) {
      if (!card.type || cardTypes.has(card.type) ||
          this.cards.has(card.type) ||
          Object.prototype.hasOwnProperty.call(STUDIO_CARD_DEFINITIONS, card.type)) {
        throw new Error(`STUDIO_CARD_TYPE_CONFLICT: ${card.type}`);
      }
      cardTypes.add(card.type);
    }
    const accepted = snapshotPlugin(plugin);
    this.plugins.set(accepted.name, accepted);
    for (const card of accepted.cards ?? []) {
      this.cards.set(card.type, Object.freeze(card));
    }
  }

  /** Remove a plugin before replacing its definitions. Create/update registries
   * before mounting Studio; runtime UI subscription is not part of API v1. */
  unregisterPlugin(name: string): boolean {
    const plugin = this.plugins.get(name);
    if (!plugin) return false;
    for (const card of plugin.cards ?? []) this.cards.delete(card.type);
    return this.plugins.delete(name);
  }

  getCard(type: string): StudioCardDefinition | undefined {
    return this.cards.get(type);
  }

  /** Render registered plugin HTML through schema validation and sanitization.
   * Prefer this to directly calling a card's untrusted renderHtml output.
   */
  renderCardHtml(type: string, data: unknown): string | null {
    const definition = this.getCard(type);
    if (!definition) return null;
    try {
      return renderStudioCardSafeHtml(definition, data);
    } catch {
      throw new StudioPluginError('RENDER_FAILED');
    }
  }

  getPlugins(): StudioPlugin[] {
    return Array.from(this.plugins.values(), snapshotPlugin);
  }
}
