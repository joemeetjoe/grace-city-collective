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
- `rectdiff.mjs` — the line boxes two `cdp-shot.mjs --rects <selector>`
  runs recorded, compared label by label: line count, and the largest
  vertical and horizontal shift of any line edge, in CSS px.

### Fonts blocked (`--block-fonts`)

`cdp-shot.mjs --block-fonts` blocks every `*.woff2` and `*.woff` request
over CDP, so the page paints in the metric-matched fallback faces
(`src/theme/fontFallback.ts`: `Geist Fallback` over Arial, `Cormorant
Garamond Fallback` over Georgia) — what a reader sees in the moment before
a web font lands. The check for #106 is the hero headline's line boxes,
fonts on against fonts blocked, on both widths:

```bash
pnpm build && pnpm preview --port 4405 --strictPort &
node tools/shots/cdp-shot.mjs --url http://localhost:4405/ --out shots/desktop \
     --size 1600x900 --dpr 2 --labels Hero --rects h1
node tools/shots/cdp-shot.mjs --url http://localhost:4405/ --out shots/desktop-nofonts \
     --size 1600x900 --dpr 2 --labels Hero --rects h1 --block-fonts
node tools/shots/rectdiff.mjs shots/desktop/state.json shots/desktop-nofonts/state.json --x 16
# mobile: --size 390x844 --mobile --dpr 3, and --x 8
```

Tolerance: the same number of lines, every top and bottom edge within
0.5 px (`--y`, the default), and every left and right edge within 0.2 em
of the headline's size — `--x 16` at the 84 px desktop hero, `--x 8` at
the 42 px mobile one. The vertical match is exact by construction: the
ascent, descent and line-gap overrides replace the local face's metrics
with the web font's. The horizontal one is not: size-adjust matches the
average advance of English text, not each glyph, so a given word runs a
little wider or narrower in Georgia than in Cormorant. Measured at #106:
y 0.00 px on both widths; x 9.55 px desktop, 4.75 px mobile. The
headline's measure is written in em rather than `ch` for the same reason
(`src/features/stops/HeroStop.tsx`): `ch` is the zero's advance, which
size-adjust does not equalise, and a wider measure wraps the lines
elsewhere.

## Fonts (`tools/fonts/`)

- `metrics.py` — the metrics behind the fallback faces: for each web font
  the site sets, the hhea ascent, descent and line gap and the
  frequency-weighted average advance of a–z and the space from the latin
  woff2 in `node_modules`, and the same average from the local face
  (`/System/Library/Fonts/Supplemental/Arial.ttf`, `Georgia.ttf`). Writes
  `src/theme/fontMetrics.json` with the size-adjust and overrides computed
  from them; `--check` recomputes and compares without writing. Its
  docstring says which metrics and why. Runs under the dore-recut venv
  (fontTools, brotli):
  `~/Projects/dore-recut/.venv-recut/bin/python tools/fonts/metrics.py --check`.
  `src/theme/fontFallback.test.ts` proves the checked-in overrides against
  the checked-in metrics with the same arithmetic in TypeScript, and
  `fonts.test.ts` that the stacks in `src/index.css` and
  `src/theme/fonts.ts` agree and name each fallback after its web font.
  Re-run the script when a font package is bumped, then `pnpm test`.

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

## Poster (`tools/poster/`)

- `ladder.py` — cuts the still poster's width ladder (640, 960, 1280, 1600,
  2048) from the darkened plate `src/assets/dore-pentecost-dark-2048.jpg`
  into `src/assets/poster/` in AVIF and WebP, with fixed encoder settings so
  a re-run is byte-identical (`--check` proves it without writing). Runs
  under the dore-recut venv, whose Pillow has both codecs:
  `~/Projects/dore-recut/.venv-recut/bin/python tools/poster/ladder.py`.
  The rungs mirror `POSTER_RUNGS` in `src/engine/posterLadder.ts`, which
  `StaticPoster` lists in its `<picture>`.

## Transfer (`tools/perf/`)

- `transfer.mjs` (`pnpm transfer`) — bytes each tier sends over the wire on
  a cold and a warm load, by category; `--reduced-motion` measures the
  poster path instead of the scene. Baseline and how to read the table
  in [`docs/perf/README.md`](../docs/perf/README.md).
- `transferReport.mjs` — the pure helpers (`classify`, `summarise`,
  `posterResponses`, `textureTiers`, `textureStartVsShell`); their tests run
  in the unit project. Against a `dist/`, each cold load is read back
  through the Vite manifest: which tier its textures came from, and
  whether the first texture request went out before the shell chunk had
  landed — the head script's preloads (#113, `src/device/tierPreload.ts`)
  put it on the wire while the shell is still downloading.
- `budget.mjs` (`pnpm budget`) — the static byte budget from `dist/` against
  `budget.json`, with a poster row for the fallback path's one image.

## Share card (`tools/share/`)

- `share-image.py` — cuts `public/share.jpg` (1200×630, under 200 kB) from
  the Doré plate as an ink-to-cream duotone; the Open Graph and Twitter tags
  point at it. Run with a Python that has Pillow
  (`~/Projects/dore-recut/.venv-recut/bin/python tools/share/share-image.py`)
  whenever the plate or the crop constants change.

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
script that could paint has run. `tests/build/surfaces.test.ts` checks the
SEO and AI surfaces the `gcc:surfaces` plugin generates from
`src/content/site.ts` (`src/content/surfaces.ts`): the head tags and JSON-LD,
the noscript block, `robots.txt`, `sitemap.xml`, `llms.txt`,
`llms-full.txt` and the share card. `tests/build/fonts.test.ts` checks the
two font preloads the `gcc:font-preload` plugin writes into the head
(`src/lib/fontPreload.ts`) and the fallback faces in the inline head style. Later Vitals slices add their config and
headless-Chrome timeline checks here; in CI the order is `test`, `build`,
`test:build`, `budget`.

## Lighthouse CI (`tools/perf/`)

`pnpm lighthouse` runs Lighthouse CI over `dist/` on two profiles — the
mobile default (a mid-tier phone on slow 4G, 4× CPU slowdown) and the
desktop preset — three runs each, asserting on the median run
(`lighthouserc.mobile.cjs`, `lighthouserc.desktop.cjs`, sharing
`lighthouseProfiles.cjs`). Errors: accessibility, SEO and best practices at
100, CLS at or under 0.01. Warnings: LCP, TBT and Speed Index against
ceilings set from the first run, per profile; how to raise one is in the
comment next to it. `lighthouse.mjs` runs both and prints one line per
profile; CI runs it after `pnpm budget` and uploads the reports as the
`lighthouse-reports` artifact whether the run is green or red.

```bash
pnpm build
pnpm lighthouse                     # both profiles
pnpm lighthouse --profile mobile    # one
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm lighthouse
```

lhci serves `dist/` itself on a free port and launches Chrome; set
`CHROME_PATH` if it cannot find one (ubuntu-latest in CI has it). Reports
land in `.lighthouseci/<profile>/` (gitignored): three `*.report.html` and
`*.report.json` pairs and a `manifest.json` whose `isRepresentativeRun`
entry is the median run the assertions read. The intro plays on every run
— Lighthouse measures a cold load — so LCP includes the splash.

The first run is committed as the vitals baseline in
[`docs/perf/lighthouse-baseline.md`](../docs/perf/lighthouse-baseline.md)
with the two median reports beside it. `tests/build/lighthouse.test.ts`
checks the configs against the installed Lighthouse: every asserted audit
id and category must exist in its default config, so a version bump cannot
drop an assertion silently (`tests/build/lighthouseConfig.ts`).
