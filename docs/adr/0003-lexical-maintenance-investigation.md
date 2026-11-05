# ADR-0003: Lexical maintenance and distribution investigation

- Date: 2026-11-05
- Status: Decision pending; current runtime remains pinned
- Scope: dependency epic and STU-902

The clean tarball consumer reveals a failure hidden by the workspace's
`skipLibCheck`: Lexical 0.13.1's declaration files import their own directory,
whose published manifest has `main: Lexical.js` and no `types` entry. Strict
consumer checking reports TS7016 and TS2677 in Lexical declarations. Both
NodeNext and Bundler resolution were tested and failed without `skipLibCheck`.

Reproduce after building:

```sh
pnpm verify:packed-consumer
pnpm verify:packed-consumer --strict-nodenext
```

These checks deliberately fail while the declaration issue is unresolved. No
consumer patch, dependency mutation, blanket type suppression or major Lexical
upgrade has been added. `--runtime-only` explicitly separates installation,
ESM/CJS/CSS and saved-fixture rollback evidence from declaration correctness.
It does not pass the type-distribution release gate.

The host reference also mixes Lexical 0.13 and 0.52 packages and owns Yjs
collaboration. A target version must be chosen with the host owner, then tested
in an isolated upgrade spike against serialized fixtures, selection/history,
tables, nested captions, cards and collaboration. No target-version compatibility
or upgrade is claimed in this branch. Temporary maintenance of the pinned
version is an open proposal, not approval for public distribution.
