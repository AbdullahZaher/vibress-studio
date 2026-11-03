import { STUDIO_CARD_DEFINITIONS, type StudioCardDefinition } from '@vibress/studio-card-definitions';

export interface StudioPlugin {
  name: string;
  version: string;
  cards?: StudioCardDefinition[];
  toolbarItems?: StudioToolbarItem[];
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

  registerPlugin(plugin: StudioPlugin): void {
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
    this.plugins.set(plugin.name, plugin);
    for (const card of plugin.cards ?? []) {
      this.cards.set(card.type, card);
    }
  }

  getCard(type: string): StudioCardDefinition | undefined {
    return this.cards.get(type);
  }

  getPlugins(): StudioPlugin[] {
    return Array.from(this.plugins.values());
  }
}
