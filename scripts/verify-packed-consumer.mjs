#!/usr/bin/env node
/** Install actual tarballs outside the workspace. Optional rollback mode
 * rebuilds an immutable baseline, installs its tarballs in the same consumer,
 * then reopens the candidate-created document. Never publishes packages. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporary = mkdtempSync(join(tmpdir(), 'studio-package-consumer-'));
const consumer = join(temporary, 'consumer');
const baselineIndex = process.argv.indexOf('--baseline-ref');
const baselineRef = baselineIndex >= 0 ? process.argv[baselineIndex + 1] : undefined;
const strictNodeNext = process.argv.includes('--strict-nodenext');
const runtimeOnly = process.argv.includes('--runtime-only');
if (baselineIndex >= 0 && !baselineRef) throw new Error('--baseline-ref requires a commit/ref');
function run(command, args, cwd) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
}
function packages(source) {
  return readdirSync(join(source, 'packages')).map(directory => ({
    directory, manifest: JSON.parse(readFileSync(join(source, 'packages', directory, 'package.json'), 'utf8')),
  }));
}
function pack(source, destination) {
  mkdirSync(destination, { recursive: true });
  const result = {};
  for (const { directory, manifest } of packages(source)) {
    const target = join(destination, directory + '.tgz');
    run('pnpm', ['pack', '--out', target], join(source, 'packages', directory));
    result[manifest.name] = 'file:' + target;
  }
  return result;
}
function install(dependencies) {
  // A fresh dependency tree prevents npm cache/version reuse from turning a
  // rollback into an accidental test of the candidate packages again.
  rmSync(join(consumer, 'node_modules'), { recursive: true, force: true });
  writeFileSync(join(consumer, 'package.json'), JSON.stringify({
    name: 'studio-clean-consumer', private: true, type: 'module',
    dependencies: { ...dependencies, react: '18.3.1', 'react-dom': '18.3.1', '@types/react': '18.3.31', '@types/react-dom': '18.3.7' },
  }, null, 2));
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false'], consumer);
}

function artifactManifest(dependencies) {
  return Object.entries(dependencies).map(([name, file]) => {
    const bytes = readFileSync(file.slice('file:'.length));
    return { name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  });
}

const smoke = `
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { StudioDocumentSchema, createDefaultStudioDocument, migrateDocument } from '@vibress/studio-core';
import { serializeStudioDocument } from '@vibress/studio-serializer';
import { renderStudioDocumentToHtml } from '@vibress/studio-renderer';
import { VibressStudio } from '@vibress/studio-react';
const require = createRequire(import.meta.url);
const names = JSON.parse(readFileSync(new URL('./names.json', import.meta.url), 'utf8'));
for (const name of names) {
  const entry = realpathSync(require.resolve(name));
  assert.ok(entry.startsWith(realpathSync(process.cwd()) + '/'), name + ' resolved outside the consumer');
  assert.ok(Object.keys(await import(name)).length > 0, name + ' ESM exports');
  assert.ok(Object.keys(require(name)).length > 0, name + ' CommonJS exports');
}
assert.equal(typeof VibressStudio, 'function');
for (const css of ['styles.css', 'tokens.css']) {
  assert.ok(readFileSync(require.resolve('@vibress/studio-react/' + css), 'utf8').length > 100);
}
const fixtureFile = new URL('./persisted.json', import.meta.url);
if (process.argv.includes('--rollback')) {
  const fixture = JSON.parse(readFileSync(fixtureFile, 'utf8'));
  const reopened = migrateDocument(fixture);
  assert.deepEqual(reopened.root, fixture.root, 'Rollback changed persisted nodes');
  assert.deepEqual(serializeStudioDocument(reopened.root).root, fixture.root, 'Rollback save changed persisted nodes');
  assert.ok(renderStudioDocumentToHtml(reopened).includes('مرحبا English'));
} else {
  const document = createDefaultStudioDocument('مرحبا English');
  document.root.children.push({ type: 'studio-card', version: 1, cardType: 'image',
    cardData: { assetId: 'durable-asset', src: '/media/asset.png', alt: 'Asset', caption: 'وصف English' } });
  document.root.children.push({ type: 'future-node', version: 1, payload: { retain: true } });
  const serialized = serializeStudioDocument(document.root);
  StudioDocumentSchema.parse(serialized);
  assert.ok(renderStudioDocumentToHtml(serialized).includes('مرحبا English'));
  writeFileSync(fixtureFile, JSON.stringify(serialized));
}
`;

try {
  mkdirSync(consumer);
  const candidate = pack(repo, join(temporary, 'candidate'));
  install(candidate);
  writeFileSync(join(consumer, 'names.json'), JSON.stringify(Object.keys(candidate)));
  writeFileSync(join(consumer, 'smoke.mjs'), smoke);
  run(process.execPath, ['smoke.mjs'], consumer);
  writeFileSync(join(consumer, 'consumer.tsx'), `
import { createDefaultStudioDocument, type StudioDocument } from '@vibress/studio-core';
import { VibressStudio } from '@vibress/studio-react';
import { renderStudioDocumentToHtml } from '@vibress/studio-renderer';
const document: StudioDocument = createDefaultStudioDocument('Consumer');
export const html: string = renderStudioDocumentToHtml(document);
export const editor = <VibressStudio value={document} metadataRevision={1} revisionId="save-1"
  replacementId="document-1" onEditorReady={(instance) => { instance?.getEditorState().toJSON(); }}
  onChange={(next: StudioDocument) => void next.root} />;
`);
  if (!runtimeOnly) run(process.execPath, [join(repo, 'node_modules/typescript/bin/tsc'), '--noEmit', '--strict', '--esModuleInterop',
    '--jsx', 'react-jsx', '--target', 'ES2022', '--module', strictNodeNext ? 'NodeNext' : 'ESNext',
    '--moduleResolution', strictNodeNext ? 'NodeNext' : 'Bundler', 'consumer.tsx'], consumer);
  const report = { candidateCommit: run('git', ['rev-parse', 'HEAD'], repo).trim(),
    workingTreeDirty: Boolean(run('git', ['status', '--porcelain'], repo).trim()),
    packages: Object.keys(candidate).length, cleanInstall: 'pass', esm: 'pass', cjs: 'pass', types: runtimeOnly ? 'not checked (--runtime-only)' : 'pass', css: 'pass',
    typeResolution: runtimeOnly ? null : strictNodeNext ? 'NodeNext' : 'Bundler',
    artifacts: artifactManifest(candidate),
    rollback: 'not requested' };
  if (baselineRef) {
    const baselineCommit = run('git', ['rev-parse', '--verify', baselineRef + '^{commit}'], repo).trim();
    const source = join(temporary, 'baseline-source');
    mkdirSync(source);
    const archive = execFileSync('git', ['archive', '--format=tar', baselineCommit], { cwd: repo, maxBuffer: 64 * 1024 * 1024 });
    execFileSync('tar', ['-x', '-C', source], { input: archive });
    run('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], source);
    run('pnpm', ['build'], source);
    const previous = pack(source, join(temporary, 'baseline'));
    install(previous);
    report.baselineArtifacts = artifactManifest(previous);
    run(process.execPath, ['smoke.mjs', '--rollback'], consumer);
    report.rollback = 'pass';
    report.baselineCommit = baselineCommit;
    report.rollbackScope = 'clean package reinstall and v1/legacy-compatible saved content; not a deployed host rollback';
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (process.env.STUDIO_KEEP_CONSUMER === '1') console.error('Retained consumer:', temporary);
  else rmSync(temporary, { recursive: true, force: true });
}
