import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { verifyLexicalContract } from './verify-lexical-contract.mjs';

for (const mismatch of [false, true]) test(`playground engine coherence (mismatch=${mismatch})`, () => {
  const root = mkdtempSync(join(tmpdir(), 'studio-lexical-contract-'));
  try {
    for (const directory of ['packages/studio-react', 'playground']) {
      mkdirSync(join(root, directory), { recursive: true });
      writeFileSync(join(root, directory, 'package.json'), JSON.stringify({ name: directory,
        dependencies: { lexical: mismatch && directory === 'playground' ? '0.13.1' : '0.14.3' } }));
    }
    if (mismatch) assert.throws(() => verifyLexicalContract(root), /playground: lexical must match/);
    else assert.equal(verifyLexicalContract(root).declarations, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
