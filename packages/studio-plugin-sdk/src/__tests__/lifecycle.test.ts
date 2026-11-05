import { describe, expect, it } from 'vitest';
import { StudioPluginRegistry } from '../index';

function card(type = 'acme-card') {
  return { type, version: 1, validate: () => ({}), renderHtml: () => '<p>Safe</p>', renderPlainText: () => 'Safe' };
}

describe('versioned trusted plugin lifecycle (STU-404/STU-701/STU-702)', () => {
  it('rejects an unsupported API version atomically', () => {
    const registry = new StudioPluginRegistry();
    expect(() => registry.registerPlugin({ name: 'future', version: '1', apiVersion: 2, cards: [card()] })).toThrow();
    expect(registry.getPlugins()).toEqual([]);
    expect(registry.getCard('acme-card')).toBeUndefined();
  });

  it('rejects malformed definitions before any card is registered', () => {
    const registry = new StudioPluginRegistry();
    expect(() => registry.registerPlugin({ name: 'invalid', version: '1', cards: [card(), { type: 'bad' }] })).toThrow();
    expect(registry.getPlugins()).toEqual([]);
    expect(registry.getCard('acme-card')).toBeUndefined();
  });

  it('isolates ownership from mutations of caller-owned objects and returned plugin lists', () => {
    const registry = new StudioPluginRegistry();
    const definition = card();
    const plugin = { name: 'one', version: '1', cards: [definition] };
    registry.registerPlugin(plugin);
    definition.type = 'changed';
    definition.renderHtml = () => 'Changed';
    plugin.cards.length = 0;
    const listed = registry.getPlugins();
    listed[0]?.cards?.splice(0);
    expect(registry.getPlugins()[0]?.cards).toHaveLength(1);
    expect(registry.renderCardHtml('acme-card', {})).toBe('<p>Safe</p>');
  });

  it('unregisters only owned cards and permits deliberate re-registration', () => {
    const registry = new StudioPluginRegistry();
    registry.registerPlugin({ name: 'one', version: '1', cards: [card()] });
    registry.registerPlugin({ name: 'two', version: '1', cards: [card('other-card')] });
    expect(registry.unregisterPlugin('one')).toBe(true);
    expect(registry.unregisterPlugin('missing')).toBe(false);
    expect(registry.getCard('acme-card')).toBeUndefined();
    expect(registry.getCard('other-card')).toBeDefined();
    registry.registerPlugin({ name: 'one', version: '2', cards: [card()] });
    expect(registry.getPlugins()).toHaveLength(2);
  });

  it('classifies throwing and non-string HTML renderer failures without exposing payloads', () => {
    for (const renderHtml of [() => { throw new Error('private payload'); }, () => 42]) {
      const registry = new StudioPluginRegistry();
      registry.registerPlugin({ name: 'bad-renderer', version: '1', cards: [{ ...card(), renderHtml }] });
      expect(() => registry.renderCardHtml('acme-card', {})).toThrow('STUDIO_PLUGIN_RENDER_FAILED');
    }
  });
});
