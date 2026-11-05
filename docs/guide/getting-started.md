# Getting started

This guide covers **the standalone source repository**. It does not install a CMS, create a database or configure media storage.

## Requirements

- Node.js 24
- pnpm 11.17.0 or later in the supported 11.x range
- Git

## Run the playground

```bash
git clone https://github.com/AbdullahZaher/vibress-studio.git
cd vibress-studio
corepack enable
pnpm install --frozen-lockfile
pnpm build
pnpm --filter vibress-studio-playground dev
```

The playground is a **local development environment**, not a deployed documentation demo. On a clean checkout, build workspace packages before launching the playground because package exports resolve through `dist`.

## Explore the code

- [Document model and migration](/architecture)
- [React editor integration](/guide/react-integration)
- [Card contracts](/cards)
- [Safe import and export](/import-export)
- [Host media adapter](/media-upload-adapter)

## Run checks

```bash
pnpm lint
pnpm verify:explicit-any
pnpm typecheck
pnpm test
pnpm verify:package-exports
pnpm test:security
pnpm test:a11y
pnpm test:roundtrip
pnpm test:e2e
```

See [Testing](/testing) for additional setup, browser dependencies and release gates.

::: warning Compatibility and publishing
The standalone packages are not proof of parity with the current Vibress CMS runtime. Check the [proposed ADR-0001](/adr/0001-studio-canonical-runtime), verify public APIs against source, and test the version you integrate. Hosting, media storage and saving stay in the host application.
:::
