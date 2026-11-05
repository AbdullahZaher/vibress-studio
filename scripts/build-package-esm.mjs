#!/usr/bin/env node
/** Build true ESM entries without bundling duplicate React/Lexical instances.
 * Legacy Lexical 0.13 is CommonJS and Node ESM cannot reliably import its
 * named exports or extensionless deep paths directly. A generated interop
 * shim keeps exactly the same peer Lexical singleton and public exports.
 */
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const cwd = process.cwd();
const requireFromPackage = createRequire(resolve(cwd, 'package.json'));
const lexicalModule = (id) => id === 'lexical' || id.startsWith('lexical/') || id.startsWith('@lexical/');
const forbidden = new Set(['default', '__esModule', 'class', 'function', 'const', 'let', 'var', 'delete', 'new', 'return', 'throw', 'export', 'import']);

await build({
  entryPoints: [resolve(cwd, 'src/index.ts')],
  outfile: resolve(cwd, 'dist/index.mjs'),
  bundle: true,
  platform: 'neutral',
  format: 'esm',
  target: ['es2022'],
  jsx: 'automatic',
  legalComments: 'none',
  plugins: [{
    name: 'cjs-lexical-interop-without-duplicate-runtime',
    setup(builder) {
      builder.onResolve({ filter: /^[^./]/ }, (args) => {
        if (args.namespace === 'lexical-cjs-shim') return { path: args.path, external: true };
        if (!lexicalModule(args.path)) return { path: args.path, external: true };
        const specifier = /^@lexical\/[^/]+\/.+/.test(args.path) && !args.path.endsWith('.js')
          ? `${args.path}.js` : args.path;
        return { path: specifier, namespace: 'lexical-cjs-shim' };
      });
      builder.onLoad({ filter: /.*/, namespace: 'lexical-cjs-shim' }, (args) => {
        const exports = requireFromPackage(args.path);
        const names = Object.keys(exports).filter((name) =>
          /^[A-Za-z_$][\w$]*$/.test(name) && !forbidden.has(name));
        const shim = ['import cjs from ' + JSON.stringify(args.path) + ';',
          'export default cjs.default ?? cjs;',
          ...names.map((name) => `export const ${name} = cjs[${JSON.stringify(name)}];`)];
        return { contents: shim.join('\n'), loader: 'js' };
      });
    },
  }],
});
