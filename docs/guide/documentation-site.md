# Maintaining this documentation site

VitePress renders the existing Markdown files under `docs/`. Its configuration lives in `docs/.vitepress/config.js`, and the website's own CSS lives in `docs/public/custom.css` (not in the editor packages).

## Develop and verify locally

```bash
corepack enable
pnpm docs:dev
pnpm docs:build
pnpm docs:preview
```

The documentation scripts use **VitePress 1.6.4**, pinned as a development dependency
with its transitive dependencies in `pnpm-lock.yaml`. `pnpm install --frozen-lockfile`
and `pnpm docs:build` reproduce the documentation build without resolving an
unlocked `pnpm dlx` tree. This dependency is not included in published editor code.

The build must pass without dead internal links. Check mobile navigation, both language switch destinations, keyboard focus, dark mode and Arabic layout manually.

## Publish

The workflow at `.github/workflows/docs-pages.yml` builds on pull requests and deploys after changes land on `main`. In repository **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source. Deployment requires GitHub Pages to be enabled for the repository.

The intended production path is `https://abdullahzaher.github.io/vibress-studio/`, so the config sets `base: '/vibress-studio/'`. A custom domain requires updating `base`, the sitemap hostname and the stylesheet URL.

Do not insert live credentials or internal host-only implementation details in public docs. Verify examples against current source; [ADR-0001](/adr/0001-studio-canonical-runtime) describes the standalone/host boundary.
