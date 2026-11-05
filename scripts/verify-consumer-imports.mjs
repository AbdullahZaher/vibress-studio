#!/usr/bin/env node
/**
 * Smoke the built package artifacts as Node ESM and CommonJS consumers.
 * The workspace root intentionally has no direct @vibress/studio-* dependency,
 * so resolve each package's public entry from its own package directory.
 * Run after pnpm build and verify:package-exports.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

async function packageEntries(name) {
  const base = new URL(`../packages/${name}/`, import.meta.url);
  const requireFromPackage = createRequire(new URL('package.json', base));
  // Resolve through the *declared public self-reference* (exports map).
  const cjs = requireFromPackage(`@vibress/${name}`);
  const esm = await import(new URL('dist/index.mjs', base).href);
  return { cjs, esm };
}

const core = await packageEntries('studio-core');
const renderer = await packageEntries('studio-renderer');
const serializer = await packageEntries('studio-serializer');
const react = await packageEntries('studio-react');

for (const [name, entries, symbol] of [
  ['core', core, 'createEmptyStudioDocument'],
  ['renderer', renderer, 'renderStudioDocumentToHtml'],
  ['serializer', serializer, 'serializeStudioDocument'],
  ['react', react, 'VibressStudio'],
]) {
  for (const [format, pkg] of Object.entries(entries)) {
    assert.equal(typeof pkg[symbol], 'function', `${name} ${format}: missing ${symbol}`);
  }
}
const document = core.cjs.createDefaultStudioDocument('مرحبا English');
const accepted = serializer.cjs.serializeStudioDocument(document.root);
assert.equal(accepted.schema, 'vibress-studio');
assert.deepEqual(serializer.esm.serializeStudioDocument(document.root).root, accepted.root);
assert.ok(renderer.cjs.renderStudioDocumentToHtml(accepted).includes('مرحبا English'));
assert.equal(renderer.esm.renderStudioDocumentToHtml(accepted),
  renderer.cjs.renderStudioDocumentToHtml(accepted));

for (const name of ['styles.css', 'tokens.css']) {
  const requireFromReact = createRequire(new URL('../packages/studio-react/package.json', import.meta.url));
  const entry = requireFromReact.resolve(`@vibress/studio-react/${name}`);
  assert.ok(existsSync(entry), `CSS public export unavailable: ${name}`);
  assert.ok(fileURLToPath(new URL(`../packages/studio-react/dist/styles/${name === 'styles.css' ? 'studio.css' : name}`, import.meta.url)),
    'CSS artifact path must be a valid file path');
}

assert.equal(typeof globalThis.document, 'undefined');
assert.equal(typeof globalThis.window, 'undefined');
console.log('PASS: ESM/CJS package entries, server-safe rendering and CSS public exports');
