# Wire batch (#95–#102): first-load bytes per tier

Eight slices, 2026-09-01/02, measured with `pnpm transfer` (tools/perf/transfer.mjs)
on the same headless Chrome, brotli on text, the deploy cache headers. Baseline
is main at `40d83b9` before any slice; final is the batch tip with every slice
merged. Cold load to the intro gate, both tiers; warm second load is fully
cached in both runs (zero bytes, every file a hit).

## Baseline → final

Baseline (`wire-baseline.json`):

```
desktop  (kB on the wire)
                gate      idle      warm
      html       1.1       1.1       0.0
        js     251.1     251.1       0.0
       css       9.5       9.5       0.0
      font      51.4      51.4       0.0
   texture    2071.5    2071.5       0.0
     other       0.6       0.6       0.0
     total    2385.3    2385.3       0.0
     files        42        42        41

mobile  (kB on the wire)
                gate      idle      warm
      html       1.1       1.1       0.0
        js     251.1     251.1       0.0
       css       9.5       9.5       0.0
      font      51.4      51.4       0.0
   texture     799.1     799.1       0.0
     other       0.6       0.6       0.0
     total    1112.8    1112.8       0.0
     files        42        42        41
```

Final, AVIF path (`wire-final.json`):

```
desktop  (kB on the wire)
                gate      idle      warm
      html       1.2       1.2       0.0
        js     248.7     248.7       0.0
       css       9.5       9.5       0.0
      font      51.4      51.4       0.0
   texture    1557.9    1557.9       0.0
     other       0.6       0.6       0.0
     total    1869.3    1869.3       0.0
     files        61        61        60

mobile  (kB on the wire)
                gate      idle      warm
      html       1.2       1.2       0.0
        js     248.7     248.7       0.0
       css       9.5       9.5       0.0
      font      51.4      51.4       0.0
   texture     614.6     614.6       0.0
     other       0.6       0.6       0.0
     total     926.0     926.0       0.0
     files        61        61        60
```

Final, WebP fallback path — a browser without AVIF (`wire-final-webp.json`,
`pnpm transfer --no-avif`): desktop 2409.1 kB, mobile 1119.5 kB (textures
2097.7 / 808.1).

| tier    | baseline | final (AVIF) | delta      | final (WebP) |
| ------- | -------: | -----------: | ---------: | -----------: |
| desktop | 2385.3   | 1869.3       | −516 kB, −21.6 % | 2409.1 |
| mobile  | 1112.8   | 926.0        | −187 kB, −16.8 % | 1119.5 |

Bytes to first interaction (html + css + shell js): 261.7 kB → 143.6 kB
(the engine chunk downloads alongside the shell, behind the splash).

## What each slice moved

| slice | what | desktop | mobile |
| --- | --- | --- | --- |
| #95 | the measurement itself; baseline committed | — | — |
| #96 | tailwind-merge + DrawSVGPlugin dropped (six `cn()` sites had relied on merge; rewritten to identical class sets) | js −31 kB raw, −10 kB gzip | same |
| #97 | textures fingerprinted through Vite, immutable for a year; cuts.json bundled; deploy drops the texture invalidation | js +12 kB raw, warm load 0 bytes | same |
| #98 | engine chunk (three.js + scene) split off, dynamically imported at mount, module-preloaded from an inline head script unless the poster path | shell js 251 → 133 kB brotli to first interaction; gate unchanged | same |
| #99 | plate retired for per-cut maps (20 new crops) | textures +26 kB | +9 kB |
| #100 | static budget from dist/.vite/manifest.json, CI workflow | — | — |
| #101 | AVIF colour textures (q64, SSIM-matched to WebP q80) with WebP fallback chosen by a one-time decode probe | textures 2097.7 → 1557.9 kB | 808.1 → 614.6 kB |
| #102 | ceilings set to measured + ~5 % | — | — |

#99 did not deliver the bytes its issue expected: the plate was already
hollowed outside the masks, so it cost only its masked content, and twenty
crops carry the same content plus their own headers. The slice stands for
uniformity — every cut is map + rect, no 2048×2519 decode and upload — and
it is what let #101 encode every colour texture the same way.

## Decisions settled in this batch

- The scene ships on mobile. The static poster remains the fallback only
  (no WebGL, reduced motion, Save-Data).
- The intro gate waits on the full tier: 28 of 32 cuts are in the hero band,
  so streaming by stop was dropped (≈10 kB gain).
- react-dom stays; the shell is React + gsap and its four plugins.
- The engine is its own chunk, preloaded from the HTML; gsap stays in the
  shell (splash and smoother need it).
- Textures are fingerprinted and immutable; only index.html is revalidated.
- AVIF is chosen client-side by a decode probe (src/device/avif.ts); no
  server logic, two static files per colour texture. Quality q64 is
  SSIM-matched to WebP q80 and awaits an eye sign-off on
  docs/design/issue-101 — re-encoding is one flag in dore-recut's pack step.
- ~~Fonts need no work~~ — revised by Vitals 4/13 (#106): the latin faces
  are preloaded with metric-matched fallbacks.
- The shot gate's default tolerance is 0.5 % of pixels; the one documented
  widening (0.75 % for the AVIF path's mobile hero) is in tools/README.md.

## Re-running

```bash
pnpm build && pnpm transfer --json docs/perf/wire-final.json
pnpm transfer --no-avif --json docs/perf/wire-final-webp.json
pnpm budget
```
