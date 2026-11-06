#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The playground is a real package consumer: mixing its engine with the React
 * package's engine creates two active editor-state contexts in the browser. */
export function verifyLexicalContract(root) {
  const read = directory => JSON.parse(readFileSync(join(root, directory, 'package.json'), 'utf8'));
  const expected = read('packages/studio-react').dependencies.lexical;
  if (!/^\d+\.\d+\.\d+$/.test(expected)) throw new Error('Pin one exact Lexical runtime version.');
  let declarations = 0;
  const directories = readdirSync(join(root, 'packages')).map(name => 'packages/' + name).concat('playground');
  for (const directory of directories) {
    const manifest = read(directory);
    for (const group of ['dependencies', 'devDependencies', 'peerDependencies']) {
      for (const [name, version] of Object.entries(manifest[group] ?? {})) {
        if (name !== 'lexical' && !name.startsWith('@lexical/')) continue;
        declarations++;
        if (version !== expected) throw new Error(`${manifest.name}: ${name} must match lexical ${expected}; found ${version}.`);
      }
    }
  }
  return { version: expected, declarations, packagesChecked: directories.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(verifyLexicalContract(resolve(dirname(fileURLToPath(import.meta.url)), '..'))));
}
