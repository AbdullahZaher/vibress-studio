# ADR-0003: Lexical maintenance and distribution investigation

- Date: 2026-11-05
- Status: Narrow standalone compatibility fix implemented; release/host adoption pending
- Scope: dependency epic and STU-902; no persisted-schema migration

## Reproduced defect

At merged main `0bd19cb21b21a2e6c703c80d6dce3d5f432ca723`, clean
Bundler and NodeNext tarball consumers fail strict checking with TS7016/TS2677.
Lexical 0.13.1 **ships index.d.ts**; its manifest lacks the `types` entry and
conditional exports needed to resolve declaration-directory self imports. The
previous investigation's wording must not be interpreted as missing files.

## Smallest evaluated compatible engine

Published tarballs were inspected. Versions 0.14.0–0.14.2 still lack that type
entry. Version **0.14.3** adds `types` and conditional import/require exports,
without adding Paragraph `textFormat` to its serialized shape. Evaluated
0.14.5/0.15.0 candidates failed two existing document-integrity tests because
they emit that additional field; those candidates were rejected. Admission was
not relaxed to hide the failure.

All 32 direct Lexical-family declarations across the thirteen packages and
playground now pin 0.14.3. An initially overlooked playground 0.13 pin reproduced
browser boot failure with two engine contexts; aligning it restored all eight
editing smoke cases. A tested `verify:lexical` CI guard prevents recurrence.

The ESM external adapter supports both native ESM namespaces and CommonJS
default exports. Lexical stays external rather than being bundled into every
Studio package. This does not promise that independently mixed ESM/CJS imports
share an editor instance. Use one coherent dependency graph and module format.

Reproduce after building:

```sh
pnpm verify:lexical
node --test scripts/*.node-test.mjs
pnpm verify:packed-consumer
pnpm verify:packed-consumer --strict-nodenext
```

Both strict clean consumers now pass without `skipLibCheck`, declaration
patches or ambient shims. The public metadata/replacement/revision props are
included in the external TSX probe. Both modes are mandatory CI steps. The
existing canonical v1 root contract and legacy `editor.lexicalVersion` hint
remain unchanged; installed package manifests identify the actual engine. That
legacy hint is not evidence of which runtime executed a document.

## Scope and outstanding gates

This is a small 0.x engine-family update in the standalone repository only.
The host still owns Yjs and a different dependency graph. No host Lexical
upgrade, canonical-runtime replacement, public release or ADR-0001 approval is
implied. Host adoption needs an explicit owner decision and separate Yjs,
selection/history, persisted-fixture and strict-consumer verification.

Primary upstream manifests:

- [Lexical 0.13.1](https://github.com/facebook/lexical/blob/v0.13.1/packages/lexical/package.json)
- [Lexical 0.14.3](https://github.com/facebook/lexical/blob/v0.14.3/packages/lexical/package.json)
