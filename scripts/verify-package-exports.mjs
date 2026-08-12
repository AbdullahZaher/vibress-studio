#!/usr/bin/env node
/**
 * Verifies package publish-readiness:
 *   1. `main` / `types` / `exports` point to `dist`, never `src`.
 *   2. Built `dist/index.js` and `dist/index.d.ts` exist.
 *   3. No `src` references in publishable entry points.
 *   4. Server-side renderer packages never import React/Lexical.
 *   5. `files` restricts published output to `dist`.
 *
 * Run after `pnpm build`.
 */
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = join(root, 'packages');

/**
 * Packages that must never import React or Lexical (server-safe).
 * studio-nodes, studio-transforms, and studio-react are editor-side and are
 * explicitly allowed to use Lexical/React.
 */
const SERVER_PACKAGES = new Set([
  '@vibress/studio-core',
  '@vibress/studio-cards',
  '@vibress/studio-utils',
  '@vibress/studio-html',
  '@vibress/studio-markdown',
  '@vibress/studio-renderer',
  '@vibress/studio-serializer',
  '@vibress/studio-plugin-sdk',
]);

const errors = [];

function check(cond, message) {
  if (!cond) errors.push(message);
}

const pkgDirs = readdirSync(packagesDir).filter((d) => existsSync(join(packagesDir, d, 'package.json')));

for (const dir of pkgDirs) {
  const pkgPath = join(packagesDir, dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  const name = pkg.name;

  check(
    pkg.main === './dist/index.js',
    `${name}: "main" must be "./dist/index.js" (got ${JSON.stringify(pkg.main)})`
  );
  check(
    pkg.types === './dist/index.d.ts',
    `${name}: "types" must be "./dist/index.d.ts" (got ${JSON.stringify(pkg.types)})`
  );

  const exportsDot = pkg.exports?.['.'];
  check(!!exportsDot, `${name}: exports["."] must exist`);
  check(
    exportsDot?.types === './dist/index.d.ts',
    `${name}: exports["."].types must point to dist`
  );
  check(
    exportsDot?.import === './dist/index.js',
    `${name}: exports["."].import must point to dist`
  );

  // No src references anywhere in publishable entry points.
  const entryJson = JSON.stringify({ main: pkg.main, types: pkg.types, exports: pkg.exports });
  check(!entryJson.includes('src/'), `${name}: publishable entry points must not reference src`);

  // files restricts to dist.
  const files = Array.isArray(pkg.files) ? pkg.files : [];
  check(files.includes('dist'), `${name}: "files" must include dist`);

  // Built output exists.
  check(
    existsSync(join(packagesDir, dir, 'dist', 'index.js')),
    `${name}: dist/index.js missing — run pnpm build first`
  );
  check(
    existsSync(join(packagesDir, dir, 'dist', 'index.d.ts')),
    `${name}: dist/index.d.ts missing — run pnpm build first`
  );

  // Server packages must not import React or Lexical (in source AND dist).
  if (SERVER_PACKAGES.has(name)) {
    const srcFiles = readdirSync(join(packagesDir, dir, 'src'), { recursive: true }).filter(
      (f) => typeof f === 'string' && /\.(ts|tsx)$/.test(f)
    );
    for (const f of srcFiles) {
      const content = readFileSync(join(packagesDir, dir, 'src', f), 'utf8');
      if (/from\s+['"](react|react-dom|lexical|@lexical\/)['"]/.test(content)) {
        errors.push(`${name}: src/${f} imports React/Lexical — server packages must not`);
      }
    }
    const distFiles = readdirSync(join(packagesDir, dir, 'dist'), { recursive: true }).filter(
      (f) => typeof f === 'string' && /\.(js|mjs)$/.test(f)
    );
    for (const f of distFiles) {
      const content = readFileSync(join(packagesDir, dir, 'dist', f), 'utf8');
      if (/from\s*['"](react|react-dom|lexical|@lexical\/)['"]/.test(content)) {
        errors.push(`${name}: dist/${f} imports React/Lexical — server packages must not`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error('PACKAGE EXPORTS VERIFICATION FAILED:');
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

console.log(`PACKAGE EXPORTS VERIFICATION PASSED (${pkgDirs.length} packages)`);
