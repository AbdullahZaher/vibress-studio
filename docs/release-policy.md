# Studio versioning, release and rollback policy

The packages remain private at 0.1.0. This branch does not publish packages,
create release tags or authorize a deployment. Node 24, pnpm 11.17 and the pinned
React/Lexical peer contracts are the current build baseline.

Public distribution needs an explicit owner decision on package visibility,
supported runtimes, declaration compatibility and version number. Use semantic
versioning: fixes preserving documented contracts are patches; additive API
capabilities are minor releases; incompatible public/document changes require a
major release, migration and tested rollback. For the current 0.x line, announce
breaking changes explicitly and bump the minor version. Never remove a document
reader or plugin API version without a documented deprecation and migration.

Every candidate needs a changelog, immutable source SHA, frozen lockfile,
package checksums, CI results, security disposition and gate approvals. Test
tarballs in a consumer outside the workspace. Workspace import smoke checks are
useful but insufficient. The strict packed-consumer declaration check currently
fails; see [ADR-0003](adr/0003-lexical-maintenance-investigation.md).

## Reproducible package verification

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm verify:package-exports
pnpm verify:consumer-imports
pnpm verify:packed-consumer
```

The last command checks installed declarations without suppressing dependency
errors. Until the known failure is resolved, the distribution gate stays open.
Runtime-only evidence can be collected separately:

```sh
pnpm verify:packed-consumer --runtime-only --baseline-ref BASELINE_COMMIT
```

That command packs thirteen packages, installs them outside the workspace,
records tarball sizes and SHA-256 checksums,
checks ESM/CJS/CSS, rebuilds the immutable previous source, reinstalls its
tarballs, and verifies that its serializer can reopen/save the candidate-created
v1 root fixture. Temporary trees are removed unless `STUDIO_KEEP_CONSUMER=1`.
This is a package rollback exercise, not a deployed host rollback or a guarantee
that older editors preserve newly recognized envelope metadata.

## Host rollout and recovery

The host release owner controls an editor-version flag: internal users, a
limited canary, an expanded audience and general availability. Expansion requires
review of initialization/load failures, save conflicts, failed uploads and
rendering failures against the approved baseline. Do not log article bodies,
tokens, selections or sensitive asset URLs. These host controls are requirements;
they are not implemented in the standalone package.

Before reverting, pause authoring, retain each user's latest recoverable draft
and original saved source, stop/resolve saves in flight, and validate candidate
documents with the intended previous runtime. If it drops fields or cannot edit
the document safely, preserve the data and offer recovery/read-only access.
Restore the prior artifact, verify save/reload/preview, and observe integrity and
error metrics before enabling authoring. Do not run a one-way migration as part
of rollback. Content loss, silent conflict overwrites, load failures or confirmed
high-severity exploits stop rollout immediately.

Named host owners must demonstrate this procedure in a real environment and
record security, product, accessibility and release sign-off. Green package
checks alone do not close those gates.
