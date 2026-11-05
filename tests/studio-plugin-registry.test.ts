import { describe, expect, it } from 'vitest';
import { StudioPluginRegistry } from '@vibress/studio-plugin-sdk';
import type { StudioCardDefinition } from '@vibress/studio-card-definitions';
import { renderStudioDocumentToHtml, renderStudioDocumentToPlainText } from '@vibress/studio-renderer';

function makeCard(type: string): StudioCardDefinition {
  return {
    type,
    version: 1,
    validate: (value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
      }
      return Object.fromEntries(Object.entries(value));
    },
    renderHtml: () => '',
    renderPlainText: () => '',
  };
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

describe('plugin HTML rendering security', () => {
  it('sanitizes plugin HTML and preserves visible text', () => {
    const registry = new StudioPluginRegistry();
    const pluginCard = makeCard('acme-markup');
    pluginCard.renderHtml = () => '<p onclick="evil()">safe</p><script>alert(1)</script>';
    registry.registerPlugin({ name: 'safe-render', version: '1', cards: [pluginCard] });
    const html = registry.renderCardHtml('acme-markup', {});
    expect(html).toContain('<p>safe</p>');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('onclick');
    expect(registry.renderCardHtml('missing-card', {})).toBeNull();
  });
});

describe('document renderer plugin integration', () => {
  it('renders custom plugin cards in document HTML with sanitization', () => {
    const registry = new StudioPluginRegistry();
    const statsCard: StudioCardDefinition = {
      type: 'custom-stats',
      version: 1,
      title: 'Custom Stats',
      description: 'Display key metrics',
      validate: (data: unknown) => {
        const d = (data && typeof data === 'object') ? data as Record<string, unknown> : {};
        return { count: Number(d.count || 0) };
      },
      renderHtml: (data: { count: number }) =>
        `<div class="custom-stats"><span>${data.count}</span><script>evil()</script><img src="x" onerror="evil()" /></div>`,
      renderPlainText: (data: { count: number }) => `Count: ${data.count}`,
    };

    registry.registerPlugin({
      name: 'metrics-plugin',
      version: '1.0.0',
      cards: [statsCard],
    });

    const doc = {
      schema: 'vibress-studio',
      version: 1,
      root: {
        type: 'root',
        children: [
          {
            type: 'studio-card',
            cardType: 'custom-stats',
            cardData: { count: 42 },
          },
        ],
      },
    };

    // Render with plugin registry
    const htmlWithPlugin = renderStudioDocumentToHtml(doc, { pluginRegistry: registry });
    expect(htmlWithPlugin).toContain('custom-stats');
    expect(htmlWithPlugin).toContain('42');
    expect(htmlWithPlugin).not.toContain('<script');
    expect(htmlWithPlugin).not.toContain('onerror');

    // Render plain text with plugin registry
    const textWithPlugin = renderStudioDocumentToPlainText(doc, { pluginRegistry: registry });
    expect(textWithPlugin).toBe('Count: 42');

    // Without plugin registry, the unknown card is dropped cleanly by the sanitizer
    const htmlWithoutPlugin = renderStudioDocumentToHtml(doc);
    expect(htmlWithoutPlugin).toBe('');
    expect(htmlWithoutPlugin).not.toContain('42');

    const textWithoutPlugin = renderStudioDocumentToPlainText(doc);
    expect(textWithoutPlugin).toBe('');
  });

  it('safely handles validation failure in plugin card', () => {
    const registry = new StudioPluginRegistry();
    const strictCard: StudioCardDefinition = {
      type: 'strict-card',
      version: 1,
      validate: () => {
        throw new Error('Invalid card data');
      },
      renderHtml: () => '<div>never rendered</div>',
      renderPlainText: () => 'never',
    };

    registry.registerPlugin({
      name: 'strict-plugin',
      version: '1.0.0',
      cards: [strictCard],
    });

    const doc = {
      schema: 'vibress-studio',
      version: 1,
      root: {
        type: 'root',
        children: [
          {
            type: 'studio-card',
            cardType: 'strict-card',
            cardData: {},
          },
        ],
      },
    };

    // Card with validation error is dropped cleanly without leaking raw errors
    const html = renderStudioDocumentToHtml(doc, { pluginRegistry: registry });
    expect(html).toBe('');
  });
});
