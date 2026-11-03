import { describe, expect, it } from 'vitest';
import { StudioPluginRegistry } from '@vibress/studio-plugin-sdk';
import type { StudioCardDefinition } from '@vibress/studio-card-definitions';

function makeCard(type: string): StudioCardDefinition {
  return { type, validate: (value: unknown) => value, renderHtml: () => '' } as StudioCardDefinition;
}

describe('StudioPluginRegistry card ownership', () => {
  it('prevents collisions across plugins without partially registering a plugin', () => {
    const registry = new StudioPluginRegistry();
    registry.registerPlugin({ name: 'one', version: '1', cards: [makeCard('acme-card')] });
    expect(() => registry.registerPlugin({ name: 'two', version: '1', cards: [makeCard('other-card'), makeCard('acme-card')] })).toThrow('STUDIO_CARD_TYPE_CONFLICT');
    expect(registry.getCard('other-card')).toBeUndefined();
    expect(registry.getPlugins()).toHaveLength(1);
  });

  it('does not allow a plugin to shadow built-in cards', () => {
    const registry = new StudioPluginRegistry();
    expect(() => registry.registerPlugin({ name: 'bad', version: '1', cards: [makeCard('image')] })).toThrow('STUDIO_CARD_TYPE_CONFLICT');
  });

  it('preserves idempotency for the same registered plugin name', () => {
    const registry = new StudioPluginRegistry();
    registry.registerPlugin({ name: 'same', version: '1', cards: [makeCard('acme-card')] });
    registry.registerPlugin({ name: 'same', version: '1', cards: [makeCard('image')] });
    expect(registry.getPlugins()).toHaveLength(1);
  });
});
