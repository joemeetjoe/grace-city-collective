# Tools

Scripts and checks that run against the built site or the repo itself, as
opposed to the app in `src/`. Each is a plain node script or a vitest
project; none is part of the bundle.

## Shots (`tools/shots/`)

- `cdp-shot.mjs` — headless-Chrome screenshots of the scene at scroll
  waypoints over CDP; the visual gate for engine and layout changes.
- `cdp-rects.mjs` — where each figure and copy panel lands at every scene
  stop, in CSS px, from a debug build (`VITE_SCENE_DEBUG=1 pnpm build`);
  the numbers the panel tucks are fitted to.
- `mobile-check.mjs` — the standing mobile guard: loads the built site at
  the four phone/tablet sizes and fails if the page is ever wider than the
  viewport (`node tools/shots/mobile-check.mjs --url http://localhost:4173/`).
- `pngdiff.mjs` — pixel diff of two shots, for before/after comparisons.

### The shot gate

A change that must not move a pixel is gated by
shooting both tiers and diffing against the batch's baseline set:

```
pnpm build && pnpm preview --port 4402 --strictPort &
node tools/shots/cdp-shot.mjs --url http://localhost:4402/ --out shots/desktop --size 1600x900 --dpr 2 --ids devotions,beliefs,faq,messages
node tools/shots/cdp-shot.mjs --url http://localhost:4402/ --out shots/mobile --size 390x844 --mobile --dpr 3 --menu --ids devotions,beliefs,faq,messages
node tools/shots/pngdiff.mjs baseline/desktop/00-hero.png shots/desktop/00-hero.png   # per shot
```

`pngdiff` prints the share of pixels with any channel delta over the
tolerance (default 8) and exits 1 when that share is over `--max` (default
0.5 %). The mobile hero at DPR 3 sits at ~0.47 % against a baseline from a
different texture encode — the 1024 tier is rendered at DPR 1.5 and upscaled,
so encoder noise is magnified — which is the headroom the default leaves.

**`--max` is only ever passed explicitly, and only where a documented
measurement says why**: the default is the gate. Known widenings:

- `--max 0.75` for the AVIF path's mobile hero (#101, docs/design/issue-101):
  the AVIF and WebP encodes of the same textures differ by ≤ 0.14 pp of
  pixels over 8 on any shot (0.05 pp on the mobile hero), and that sits on
  top of the 0.47 % re-encode noise above — measured 0.55 %. Every other
  shot of the AVIF path is under 0.5 % at the default.

`--no-avif` presets the AVIF verdict (src/device/avif.ts) to false so the
WebP fallback path can be shot in the same Chrome; `state.json` records the
verdict each capture ran under.

## Transfer (`tools/perf/`)

- `transfer.mjs` (`pnpm transfer`) — bytes each tier sends over the wire on
  a cold and a warm load, by category. Baseline and how to read the table
  in [`docs/perf/README.md`](../docs/perf/README.md).
- `transferReport.mjs` — the pure helpers (`classify`, `summarise`); their
  tests run in the unit project.

## Build-output tests (`tests/build/`)

A second vitest project that reads `dist/` instead of `src/`:

```
pnpm build        # writes dist/
pnpm test:build   # runs only tests/build/**/*.test.ts, in node
```

`pnpm test` runs only the unit project (`src/**/*.test.{ts,tsx}` and
`tools/perf/*.test.mjs`, in jsdom) and never needs a build. The two
projects are defined under `test.projects` in `vite.config.ts`; neither
picks up the other's files. Without a `dist/`, `pnpm test:build` stops in
one line (`tests/build/globalSetup.ts`) rather than failing test by test.

Helpers for new checks live in `tests/build/dist.ts`: `DIST_DIR`,
`distPath(rel)`, `hasDist()`, `readDist(rel)` and `distIndexHtml()`.
`tests/build/splashOrder.ts` holds the first predicate,
`splashPrecedesBodyScripts(html)`: the static splash is the first thing in
`<body>`, ahead of every body `<script>`, so it is on screen before any
script that could paint has run. Later Vitals slices add their head-markup,
generated-file, config and headless-Chrome timeline checks here; in CI the
order is `test`, `build`, `test:build`, `budget`.
