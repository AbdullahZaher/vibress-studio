#!/usr/bin/env node
/**
 * Smoke public built consumer entrypoints through both Node require and ESM
 * import. Run after pnpm build. This is NOT an independent installed-package
 * or browser accessibility/performance certification.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
const require = createRequire(import.meta.url);

const coreCjs = require('@vibress/studio-core');
const coreEsm = await import('@vibress/studio-core');
const rendererCjs = require('@vibress/studio-renderer');
const rendererEsm = await import('@vibress/studio-renderer');
const serializerCjs = require('@vibress/studio-serializer');
const serializerEsm = await import('@vibress/studio-serializer');
const reactCjs = require('@vibress/studio-react');
const reactEsm = await import('@vibress/studio-react');

for (const [name, pkg, symbol] of [
  ['core CJS', coreCjs, 'createEmptyStudioDocument'],
  ['core ESM', coreEsm, 'createEmptyStudioDocument'],
  ['renderer CJS', rendererCjs, 'renderStudioDocumentToHtml'],
  ['renderer ESM', rendererEsm, 'renderStudioDocumentToHtml'],
  ['serializer CJS', serializerCjs, 'serializeStudioDocument'],
  ['serializer ESM', serializerEsm, 'serializeStudioDocument'],
  ['react CJS', reactCjs, 'VibressStudio'],
  ['react ESM', reactEsm, 'VibressStudio'],
]) {
  assert.equal(typeof pkg[symbol], 'function', `${name}: missing ${symbol}`);
}
const doc = coreCjs.createDefaultStudioDocument('مرحبا English');
const accepted = serializerCjs.serializeStudioDocument(doc.root);
assert.equal(accepted.schema, 'vibress-studio');
assert.deepEqual(serializerEsm.serializeStudioDocument(doc.root).root, accepted.root);
assert.ok(rendererCjs.renderStudioDocumentToHtml(accepted).includes('مرحبا English'));
assert.equal(rendererEsm.renderStudioDocumentToHtml(accepted),
  rendererCjs.renderStudioDocumentToHtml(accepted));
for (const entry of ['@vibress/studio-react/styles.css', '@vibress/studio-react/tokens.css']) {
  assert.ok(existsSync(require.resolve(entry)), `CSS public export unavailable: ${entry}`);
}
assert.equal(typeof globalThis.document, 'undefined',
  'Server-side consumer test must not rely on browser document');
assert.equal(typeof globalThis.window, 'undefined',
  'Server-side consumer test must not rely on browser window');
console.log('PASS: built ESM/CJS imports, public editor exports, SSR renderer and CSS paths');
