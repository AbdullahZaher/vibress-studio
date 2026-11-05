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
  plugins: [{
    name: 'node-resolvable-lexical-esm-subpaths',
    setup(builder) {
      // @lexical/react historically exposes CommonJS .js subpath files
      // without Node ESM extensionless subpath exports (Lexical 0.13.1).
      // Preserve peer/runtime deduplication by keeping them external, but
      // emit the real Node-resolvable file specifier, not a missing path.
      builder.onResolve({ filter: /^@lexical\\/[^/]+\\/.+/ }, (args) => {
        const entry = args.path.endsWith('.js') ? args.path : `${args.path}.js`;
        return { path: entry, external: true };
      });
    },
  }],
});
