import { describe, it, expect } from 'vitest';
import {
  StudioPluginRegistry,
  StudioPlugin,
  StudioPluginManifest,
  StudioPluginCardDefinition,
  StudioPluginError,
  validatePluginManifest,
} from '@vibress/studio-plugin-sdk';
import { XSS_PAYLOADS } from './xss-payloads.test';

/**
 * P8: plugin safety. Host sanitizes plugin output by default; raw-html is
 * capability-gated; invalid manifests and duplicate ids are rejected.
 */

function makeCard(type: string, renderHtml: (d: Record<string, unknown>) => string): StudioPluginCardDefinition {
  return {
    type,
    version: 1,
    trustLevel: 'host-sanitized',
    validate: (d) => d as Record<string, unknown>,
    renderHtml,
    renderPlainText: () => '',
  };
}

function makePlugin(
  id: string,
  capabilities: StudioPluginManifest['capabilities'] = [],
  cards: StudioPluginCardDefinition[] = [],
  extra?: (reg: Parameters<StudioPlugin['install']>[0]) => void
): StudioPlugin {
  return {
    manifest: { id, name: id, version: '1.0.0', capabilities },
    install: (registration) => {
      for (const card of cards) registration.registerCard(card);
      extra?.(registration);
    },
  };
}

describe('Plugin manifest validation (P8)', () => {
  it('accepts valid manifests', () => {
    expect(validatePluginManifest({ id: 'my-plugin', name: 'My Plugin', version: '1.0.0', capabilities: ['render-html'] }).id).toBe('my-plugin');
  });

  it('rejects invalid ids, versions, and capabilities', () => {
    expect(() => validatePluginManifest({ id: 'bad id!', name: 'x', version: '1.0.0', capabilities: [] })).toThrow(StudioPluginError);
    expect(() => validatePluginManifest({ id: 'ok', name: 'x', version: 'abc', capabilities: [] })).toThrow(StudioPluginError);
    expect(() => validatePluginManifest({ id: 'ok', name: 'x', version: '1.0.0', capabilities: ['not-a-capability' as never] })).toThrow(StudioPluginError);
  });

  it('rejects duplicate plugin ids', () => {
    const registry = new StudioPluginRegistry();
    registry.registerPlugin(makePlugin('dup'));
    expect(() => registry.registerPlugin(makePlugin('dup'))).toThrow(/DUPLICATE_PLUGIN/);
  });

  it('rejects duplicate card types', () => {
    const registry = new StudioPluginRegistry();
    registry.registerPlugin(makePlugin('a', [], [makeCard('x', () => '')]));
    expect(() => registry.registerPlugin(makePlugin('b', [], [makeCard('x', () => '')]))).toThrow(/DUPLICATE_CARD/);
  });

  it('rolls back the plugin on install failure', () => {
    const registry = new StudioPluginRegistry();
    expect(() =>
      registry.registerPlugin(
        makePlugin('boom', [], [makeCard('y', () => '')], (reg) => {
          reg.registerCard(makeCard('y', () => '')); // duplicate within install → throws
        })
      )
    ).toThrow();
    expect(registry.getPlugins().find((p) => p.id === 'boom')).toBeUndefined();
  });
});

describe('Plugin capability gating (P8)', () => {
  it('denies raw-html trust without the capability', () => {
    const registry = new StudioPluginRegistry();
    const evil: StudioPluginCardDefinition = {
      type: 'evil',
      version: 1,
      trustLevel: 'trusted',
      validate: (d) => d as Record<string, unknown>,
      renderHtml: () => '<script>alert(1)</script>',
      renderPlainText: () => '',
    };
    expect(() => registry.registerPlugin(makePlugin('evil-plugin', [], [evil]))).toThrow(/raw-html/);
  });

  it('denies toolbar/slash/upload without capabilities', () => {
    const registry = new StudioPluginRegistry();
    expect(() =>
      registry.registerPlugin(
        makePlugin('t', [], [], (reg) => reg.registerToolbarAction({ id: 'x', label: 'X', execute: () => undefined }))
      )
    ).toThrow(/toolbar-command/);

    expect(() =>
      registry.registerPlugin(
        makePlugin('s', [], [], (reg) => reg.registerSlashCommand({ id: 's', label: 'S', execute: () => undefined }))
      )
    ).toThrow(/slash-command/);

    expect(() =>
      registry.registerPlugin(
        makePlugin('u', [], [], (reg) => reg.registerUploadProvider({ upload: async () => ({ id: 'x', url: 'u', mimeType: 'x', size: 1 }) }))
      )
    ).toThrow(/upload/);
  });

  it('host can block unsafe capabilities entirely', () => {
    const registry = new StudioPluginRegistry({ allowedCapabilities: ['render-html'] });
    expect(() =>
      registry.registerPlugin(
        makePlugin('raw', ['raw-html'], [makeCard('c', () => '')])
      )
    ).toThrow(/CAPABILITY_REQUIRED|raw-html/);
  });
});

describe('Host sanitization of plugin output (P8)', () => {
  it('sanitizes host-sanitized card output by default', () => {
    const registry = new StudioPluginRegistry();
    registry.registerPlugin(
      makePlugin('p', ['raw-html'], [
        makeCard('plugin-card', () => XSS_PAYLOADS.join('\n')),
      ])
    );
    const card = registry.getCard('plugin-card');
    expect(card).toBeTruthy();
    const html = card!.renderHtml({});
    expect(html).not.toMatch(/<(script|iframe|svg|math|form)\b/i);
    expect(html).not.toMatch(/\son\w+\s*=/i);
    expect(html).not.toContain('javascript:');
  });

  it('allows raw output only with raw-html capability AND trusted level', () => {
    const registry = new StudioPluginRegistry();
    const rawCard: StudioPluginCardDefinition = {
      type: 'raw-card',
      version: 1,
      trustLevel: 'trusted',
      validate: (d) => d as Record<string, unknown>,
      renderHtml: () => '<p>trusted</p>',
      renderPlainText: () => '',
    };
    registry.registerPlugin(makePlugin('trusted-plugin', ['raw-html'], [rawCard]));
    expect(registry.getCard('raw-card')!.renderHtml({})).toBe('<p>trusted</p>');
  });

  it('custom renderers are always host-sanitized', () => {
    const registry = new StudioPluginRegistry();
    registry.registerPlugin(
      makePlugin('rend', ['render-html'], [], (reg) =>
        reg.registerRenderer('custom-card', () => '<script>alert(1)</script><p>ok</p>')
      )
    );
    const render = registry.getRenderer('custom-card');
    expect(render).toBeTruthy();
    expect(render!({})).not.toContain('<script>');
    expect(render!({})).toContain('ok');
  });

  it('malicious plugin renderer output cannot bypass the sanitizer', () => {
    const registry = new StudioPluginRegistry();
    registry.registerPlugin(
      makePlugin('xss-plugin', ['render-html'], [], (reg) =>
        reg.registerRenderer('xss-card', () => '<img src=x onerror=alert(1)>')
      )
    );
    const out = registry.getRenderer('xss-card')!({});
    expect(out).not.toContain('onerror');
  });
});

describe('Plugin upload provider (P8)', () => {
  it('rejects invalid upload providers even with capability', () => {
    const registry = new StudioPluginRegistry();
    expect(() =>
      registry.registerPlugin(
        makePlugin('up', ['upload'], [], (reg) => reg.registerUploadProvider({ nope: true }))
      )
    ).toThrow(/INVALID_UPLOAD_PROVIDER/);
  });

  it('accepts valid upload providers with capability', () => {
    const registry = new StudioPluginRegistry();
    registry.registerPlugin(
      makePlugin('up', ['upload'], [], (reg) =>
        reg.registerUploadProvider({ upload: async () => ({ id: 'x', url: 'u', mimeType: 'x', size: 1 }) })
      )
    );
    expect(registry.hasUploadProvider('up')).toBe(true);
  });
});
