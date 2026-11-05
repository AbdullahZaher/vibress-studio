import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Studio Style Isolation & Visual Design System (STU-R06, STU-R10)', () => {
  const cssPath = path.resolve(__dirname, '../styles/studio.css');
  const tokensPath = path.resolve(__dirname, '../styles/tokens.css');
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  const tokensContent = fs.readFileSync(tokensPath, 'utf8');

  it('contains NO unscoped global :focus-visible rules (STU-R10)', () => {
    // A bare `:focus-visible {` selector without a scope selector leaks to host pages
    const bareFocusVisible = /^\s*:focus-visible\s*\{/m;
    expect(cssContent).not.toMatch(bareFocusVisible);

    // Focus-visible must be present but scoped to Studio editor or popover containers
    expect(cssContent).toContain('.vibress-studio-editor :focus-visible');
    expect(cssContent).toContain('.studio-glassy-menu :focus-visible');
    expect(cssContent).toContain('[data-studio-card] :focus-visible');
  });

  it('contains NO unscoped global reduced-motion rules affecting host elements (STU-R10)', () => {
    // Matching `@media (prefers-reduced-motion: reduce) { \s* \*`
    const bareGlobalMotion = /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\*\s*,\s*\*::before/m;
    expect(cssContent).not.toMatch(bareGlobalMotion);

    // Reduced motion must be scoped to Studio surfaces
    expect(cssContent).toContain('.vibress-studio-editor *');
    expect(cssContent).toContain('.studio-glassy-menu *');
    expect(cssContent).toContain('[data-studio-card] *');
  });

  it('defines self-contained styles for all card editor components (STU-R06)', () => {
    const cardSelectors = [
      '.vb-image-card',
      '.vb-gallery-card',
      '.vb-video-card',
      '.vb-audio-card',
      '.vb-file-card',
      '.vb-bookmark-card',
      '.vb-button-card',
      '.vb-callout-card',
      '.vb-toggle-card',
      '.vb-markdown-card',
      '.vb-html-card',
      '.vb-card-placeholder',
      '.vb-url-placeholder',
      '.vb-media-floating-toolbar',
    ];

    for (const selector of cardSelectors) {
      expect(cssContent, `Expected studio.css to contain ${selector}`).toContain(selector);
    }
  });

  it('provides accessible callout themes across all color variants (STU-R06)', () => {
    const colors = ['grey', 'blue', 'green', 'yellow', 'red', 'pink', 'purple'];
    for (const color of colors) {
      expect(cssContent, `Expected callout theme for ${color}`).toContain(`[data-color="${color}"]`);
    }
  });

  it('defines comprehensive --vb-studio-* design tokens with light and dark themes', () => {
    const requiredTokens = [
      '--vb-studio-canvas',
      '--vb-studio-surface',
      '--vb-studio-surface-muted',
      '--vb-studio-popover',
      '--vb-studio-popover-foreground',
      '--vb-studio-foreground',
      '--vb-studio-foreground-muted',
      '--vb-studio-border',
      '--vb-studio-primary',
      '--vb-studio-ring',
      '--vb-studio-radius-lg',
      '--vb-studio-measure-reading',
    ];

    for (const token of requiredTokens) {
      expect(tokensContent, `Expected tokens.css to declare ${token}`).toContain(token);
    }

    // Must define dark mode variants
    expect(tokensContent).toContain('.dark');
    expect(tokensContent).toContain('[data-theme="dark"]');
  });
});
