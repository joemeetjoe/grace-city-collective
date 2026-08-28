# Grace City Collective

A single-page site for Grace City Collective: an animated intro (seal and
lockup), then Gustave Doré's *The Descent of the Holy Spirit* cut into depth
layers and driven by scroll as a parallax scene.

**Demo:** https://joemeetjoe.github.io/grace-city-collective/

## Develop

```bash
pnpm install
pnpm dev      # Vite dev server
pnpm test     # Vitest
pnpm lint     # ESLint
pnpm build    # tsc + Vite → dist/
```

Vite 8, React 19, TypeScript, Tailwind 4, three.js, gsap.

## Base path

Runtime asset URLs (`public/dore/…`) go through `assetUrl()` in
`src/lib/assetBase.ts`, which prefixes `import.meta.env.BASE_URL`. That value
comes from `BASE_PATH` at build time and defaults to `/`:

```bash
pnpm build                                  # custom domain / root:  /
BASE_PATH=/grace-city-collective/ pnpm build # project Pages URL
```

`.github/workflows/pages.yml` builds with the Pages base on every push to
`main` and deploys `dist/` via `actions/deploy-pages`. Point a custom domain at
the site and drop the env var; nothing else changes.

## Recut toolchain

The Doré layers in `public/dore/` are produced by the Python scripts in
`tools/recut` (SAM segmentation, depth baking, SDXL inpainting of occluded
figures). They expect a `.venv-recut` virtualenv and write scratch output to
`tools/recut/out-*`, both gitignored. `tools/shots/cdp-shot.mjs` takes
headless-Chrome screenshots of the scene at scroll waypoints.
