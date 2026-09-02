# tools/

Scripts the repo's gates run. None ship; each has its usage in its header.

## shots/ — the shot gate

`cdp-shot.mjs` screenshots the built site at every scene waypoint (and the
long-form stops named by `--ids`) in hardware headless Chrome; `pngdiff.mjs`
compares two captures. A change that must not move a pixel is gated by
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

`cdp-rects.mjs`, `mobile-check.mjs` and `mask-bboxes.json` are the layout
measurements the panel/figure tuck and the mask-bounds tests rest on.

## perf/ — bytes

`transfer.mjs` (`pnpm transfer`) measures what a first load actually sends,
per tier, in the same headless Chrome (`--no-avif` for the WebP path);
`budget.mjs` (`pnpm budget`) sums the same first load statically from
`dist/` against `budget.json` and runs in CI. docs/perf/README.md has the
method and the baselines.
