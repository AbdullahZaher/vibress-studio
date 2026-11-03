#!/usr/bin/env node
/** Build a true ESM entry point without breaking existing CommonJS consumers.
 * Run from a package directory after tsc has generated declarations.
 * Bare dependencies stay external; source-relative imports are bundled so
 * Node ESM does not depend on extensionless emitted specifiers.
 */
import { build } from 'esbuild';
import { resolve } from 'node:path';

const cwd = process.cwd();
await build({
  entryPoints: [resolve(cwd, 'src/index.ts')],
  outfile: resolve(cwd, 'dist/index.mjs'),
  bundle: true,
  packages: 'external',
  platform: 'neutral',
  format: 'esm',
  target: ['es2022'],
  jsx: 'automatic',
  legalComments: 'none',
});
