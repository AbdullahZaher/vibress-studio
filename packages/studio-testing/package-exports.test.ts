import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * P7: package publish-readiness smoke tests. The verify script
 * (`pnpm verify:package-exports`) performs the full check; these tests
 * double-check the critical invariants and that built dist entry points
 * resolve without React/Lexical leakage into server packages.
 */

const ROOT = join(import.meta.dirname, '..', '..');
const PACKAGES = [
  'studio-core',
  'studio-cards',
  'studio-utils',
  'studio-html',
  'studio-markdown',
  'studio-renderer',
  'studio-serializer',
  'studio-transforms',
  'studio-plugin-sdk',
  'studio-nodes',
  'studio-react',
  'studio-testing',
];

const SERVER_PACKAGES = [
  'studio-core',
  'studio-cards',
  'studio-utils',
  'studio-html',
  'studio-markdown',
  'studio-renderer',
  'studio-serializer',
  'studio-plugin-sdk',
];

describe('Package exports (P7)', () => {
  it.each(PACKAGES)('%s points main/types/exports to dist', (pkg) => {
    const manifest = JSON.parse(readFileSync(join(ROOT, 'packages', pkg, 'package.json'), 'utf8'));
    expect(manifest.main).toBe('./dist/index.js');
    expect(manifest.types).toBe('./dist/index.d.ts');
    expect(manifest.exports['.'].types).toBe('./dist/index.d.ts');
    expect(manifest.exports['.'].import).toBe('./dist/index.js');
    expect(JSON.stringify(manifest)).not.toContain('src/index.ts');
  });

  it.each(PACKAGES)('%s has built dist artifacts', (pkg) => {
    expect(existsSync(join(ROOT, 'packages', pkg, 'dist', 'index.js'))).toBe(true);
    expect(existsSync(join(ROOT, 'packages', pkg, 'dist', 'index.d.ts'))).toBe(true);
  });

  it.each(SERVER_PACKAGES)('%s (server package) never imports React/Lexical', (pkg) => {
    const src = readFileSync(join(ROOT, 'packages', pkg, 'src', 'index.ts'), 'utf8');
    expect(src).not.toMatch(/from\s+['"](react|react-dom|lexical|@lexical\/)['"]/);
  });
});

describe('Server renderer layering (P7)', () => {
  it('studio-renderer dist output has no lexical/react imports', () => {
    const dist = readFileSync(join(ROOT, 'packages', 'studio-renderer', 'dist', 'index.js'), 'utf8');
    expect(dist).not.toMatch(/from\s*['"](react|react-dom|lexical|@lexical\/)['"]/);
  });

  it('studio-html dist output has no lexical/react imports', () => {
    const dist = readFileSync(join(ROOT, 'packages', 'studio-html', 'dist', 'index.js'), 'utf8');
    expect(dist).not.toMatch(/from\s*['"](react|react-dom|lexical|@lexical\/)['"]/);
  });

  it('studio-cards no longer exports the Lexical node', () => {
    const dist = readFileSync(join(ROOT, 'packages', 'studio-cards', 'dist', 'index.js'), 'utf8');
    expect(dist).not.toContain('StudioCardNode');
  });
});

describe('Dist runtime smoke (P12)', () => {
  const dist = (pkg: string): string =>
    pathToFileURL(join(ROOT, 'packages', pkg, 'dist', 'index.js')).href;

  it('server renderer dist loads in Node ESM and renders safely', async () => {
    const { renderStudioDocumentToHtml } = await import(/* @vite-ignore */ dist('studio-renderer'));
    const html = renderStudioDocumentToHtml({
      schema: 'vibress-studio',
      version: 1,
      root: {
        type: 'root',
        children: [
          { type: 'paragraph', children: [{ type: 'text', text: '<script>alert(1)</script>', format: 0 }] },
        ],
      },
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('studio-html dist imports a document', async () => {
    const { htmlToStudioDocument } = await import(/* @vite-ignore */ dist('studio-html'));
    const doc = htmlToStudioDocument('<h1>Hi</h1><p>Body</p>');
    expect(doc.root.children.length).toBe(2);
  });

  it('studio-markdown dist exports and imports', async () => {
    const { studioDocumentToMarkdown } = await import(/* @vite-ignore */ dist('studio-markdown'));
    const md = studioDocumentToMarkdown({
      schema: 'vibress-studio',
      version: 1,
      root: { type: 'root', children: [{ type: 'heading', tag: 'h1', children: [{ type: 'text', text: 'T', format: 0 }] }] },
    });
    expect(md).toContain('# T');
  });
});
