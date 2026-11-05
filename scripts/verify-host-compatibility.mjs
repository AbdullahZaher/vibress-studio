#!/usr/bin/env node
/** Compare immutable host source with the same versioned persisted fixtures.
 * Does not read dirty host files, execute host services or assert runtime parity. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import * as standalone from '../packages/studio-core/dist/index.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const arg = name => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : undefined; };
const host = arg('--host');
const ref = arg('--ref');
if (!host || !ref) throw new Error('Usage: verify-host-compatibility.mjs --host PATH --ref IMMUTABLE_COMMIT');
const git = args => execFileSync('git', ['-C', resolve(host), ...args], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
const hostCommit = git(['rev-parse', '--verify', ref + '^{commit}']).trim();
const directory = mkdtempSync(join(tmpdir(), 'studio-host-contract-'));
try {
  // Materialize the immutable core source tree, including relative imports.
  // Resolving against the standalone tree could accidentally mix two runtimes.
  const corePath = 'packages/studio-core/src';
  for (const file of git(['ls-tree', '-r', '--name-only', hostCommit, '--', corePath]).trim().split('\n')) {
    if (!file) continue;
    const destination = join(directory, file);
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, git(['show', hostCommit + ':' + file]));
  }
  const result = await build({ entryPoints: [join(directory, corePath, 'index.ts')],
    bundle: true, write: false, format: 'esm', platform: 'node', target: 'node24',
    nodePaths: [join(repo, 'packages/studio-core/node_modules')],
  });
  const entry = join(directory, 'host-core.mjs');
  writeFileSync(entry, result.outputFiles[0].text);
  const hostCore = await import(pathToFileURL(entry).href);
  const fixtures = JSON.parse(readFileSync(join(repo, 'packages/studio-testing/fixtures/compatibility-v1.json'), 'utf8'));
  const results = [];
  for (const fixture of fixtures.documents) {
    try {
      const accepted = standalone.migrateDocument(fixture.input);
      const hostDocument = hostCore.migrateDocument(fixture.input);
      const persisted = value => JSON.parse(JSON.stringify(value));
      assert.deepEqual(persisted(hostDocument), persisted(accepted));
      assert.deepEqual(persisted(standalone.migrateDocument(JSON.stringify(hostDocument))), persisted(accepted));
      results.push({ fixture: fixture.name, status: 'pass' });
    } catch { results.push({ fixture: fixture.name, status: 'fail', reason: 'Persisted document changed or was rejected across repositories' }); }
  }
  for (const fixture of fixtures.invalid) {
    let rejected = false;
    try { hostCore.migrateDocument(fixture.input); } catch { rejected = true; }
    results.push({ fixture: fixture.name, status: rejected ? 'pass' : 'fail',
      ...(rejected ? {} : { reason: 'Host accepted input that requires non-destructive recovery' }),
    });
  }
  const failed = results.some(result => result.status === 'fail');
  console.log(JSON.stringify({ hostCommit, scope: 'Persisted core fixtures only; no renderer/editor/Yjs/service parity asserted',
    status: failed ? 'blocked' : 'pass', results }, null, 2));
  if (failed) process.exitCode = 1;
} finally { rmSync(directory, { recursive: true, force: true }); }
