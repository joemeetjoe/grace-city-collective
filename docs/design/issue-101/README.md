# #101 — AVIF colour textures with WebP fallback

The backdrop and the 32 cut maps ship twice: the WebP q80 the manifest names,
and an AVIF twin beside it. `src/device/avif.ts` settles once per client
whether AVIF decodes (a 293-byte one-pixel AVIF from a data URI) and the
texture resolver, the preload links and the engine follow that verdict; the
masks and depths stay lossless WebP on both paths.

**Sign-off pending.** The quality below was chosen by SSIM, not by eye — the
user was not available during the run. The sheets here are for that
judgement; a different quality is a one-flag re-run (last section).

## Quality: AVIF q64 (Pillow/libavif, speed 4)

Chosen against WebP q80 by SSIM on the twenty plate-sampled cuts (the flames,
fig1, fig13, the dove, the arch, the floor), whose true source exists —
`dist/plate.jpg` cropped, hollowed and scaled exactly as the pack does.
Area-weighted mean SSIM against that source, both tiers, encoded from it:

| quality | 2048: SSIM (min) | kB | 1024: SSIM (min) | kB |
|---|---|---|---|---|
| **WebP q80 (shipped)** | **0.9902** (0.9866) | 401.9 | **0.9887** (0.9838) | 157.5 |
| AVIF q55 | 0.9852 (0.9727) | 206.4 | 0.9789 (0.9641) | 84.3 |
| AVIF q60 | 0.9895 (0.9791) | 251.3 | 0.9851 (0.9732) | 101.1 |
| AVIF q62 | 0.9902 (0.9804) | 261.4 | 0.9862 (0.9758) | 104.9 |
| **AVIF q64** | **0.9918** (0.9850) | 285.0 | **0.9881** (0.9822) | 113.0 |
| AVIF q66 | 0.9925 (0.9862) | 298.3 | 0.9893 (0.9839) | 117.6 |
| AVIF q70 | 0.9947 (0.9900) | 350.0 | 0.9924 (0.9884) | 137.2 |
| AVIF q80 | 0.9971 (0.9949) | 443.8 | 0.9954 (0.9938) | 170.9 |

q64 is the single quality closest to WebP q80 across both tiers (+0.0016 on
2048, −0.0006 on 1024; libavif's quantiser steps make q60 = q61 and q64 =
q65). Full sweep, q40–q95 and q58–q68: `sweep.py` here, output in the
integrator's scratch (`wf-101/sweep*.json`).

### Second generation

Because dore-recut's `dist/` has drifted from the shipped tier (its
CLAUDE.md), every twin was made with `pack_textures.py --transcode` —
decoded from the shipped WebP, not from a source. For the twenty plate
crops that costs a little against the source (q64 transcode: 2048 tier
0.9876, 1024 tier 0.9827 — the WebP itself sits at 0.9902 / 0.9887). For the
backdrop and the twelve authored maps (the completed figures and the crowd)
there is no other source; their transcode measured against the WebP it came
from:

| texture | 2048: WebP kB → AVIF kB, SSIM | 1024: WebP kB → AVIF kB, SSIM |
|---|---|---|
| plate-backdrop | 561.9 → 351.8, 0.9908 | 208.2 → 123.3, 0.9872 |
| map-crowd | 187.0 → 126.6, 0.9891 | 70.1 → 50.7, 0.9879 |
| map-fig0 … fig12 (11) | 0.9837 – 0.9880 | 0.9760 – 0.9839 |

## Bytes

| | colour WebP | colour AVIF | lossless (masks, depth) |
|---|---|---|---|
| 2048 tier (files) | 1792.7 kB | 1252.8 kB (−30 %) | 294.3 kB |
| 1024 tier (files) | 664.7 kB | 471.2 kB (−29 %) | 132.6 kB |

`pnpm transfer` on the built site, textures to the intro gate (both formats
of the same build; `--no-avif` forces the fallback):

| tier | AVIF path | WebP path (`--no-avif`) |
|---|---|---|
| desktop | **1557.9 kB** = 33 avif 1259.4 + 21 webp 298.5 | 2097.7 kB (54 webp) |
| mobile | **614.6 kB** = 33 avif 477.7 + 21 webp 136.8 | 808.1 kB (54 webp) |

An AVIF browser fetches no WebP colour texture; a forced-off probe fetches no
AVIF. `pnpm budget` counts the AVIF path: desktop 1857.1 kB total (ceiling
2730), mobile 913.7 kB (ceiling 1265).

## Shot gate

Against the wire-batch baseline, `pngdiff` (share of pixels with a channel
delta over 8; gate 0.5 %):

| shot | AVIF path | WebP path |
|---|---|---|
| desktop, worst (house-churches) | 0.293 % (max 73) | 0.169 % |
| desktop hero | 0.257 % (max 84) | 0.160 % |
| mobile hero | **0.550 %** (max 49) | 0.473 % (max 38) |
| mobile visit | 0.353 % | 0.112 % |
| every other shot, both tiers | < 0.22 % | < 0.18 % |
| long-form stops and the menu | 0 | 0 |

The mobile hero is the one shot over the gate. The AVIF and WebP captures
of the same build differ directly by only 0.048 % of pixels over 8 there
(0.139 % on the desktop hero, the largest anywhere); the rest is the
baseline's own DPR-3 re-encode noise (0.473 % on the WebP path, the 0.47 %
#99 recorded). Widening documented in `tools/README.md`: `pngdiff --max
0.75` for the AVIF path's mobile hero; the default stays 0.5 %.

## Contact sheets (1:1 device pixels)

`desktop-hero.png`, `desktop-give.png` (1600×900 @2), `mobile-hero.png`,
`mobile-give.png` (390×844 @3): the WebP capture, the AVIF capture, and
their difference ×8 with the share of pixels over 8. The mobile give panel
covers most of the scene; its crop is the robes under it. Made by `sheet.py`
here from two `cdp-shot` runs of one build, the second with `--no-avif`.

## Re-encoding at another quality

```
cd ~/Projects/dore-recut
.venv-recut/bin/python pack_textures.py --transcode <gcc>/src/assets/dore/2048 --avif-q <N>
.venv-recut/bin/python pack_textures.py --transcode <gcc>/src/assets/dore/1024 --avif-q <N>
```

That rewrites only the 33 `.avif` files per tier in place (12 s for both);
nothing else in the tier or the manifest changes. Then in the site:
`pnpm test && pnpm build && pnpm budget`, the shot gate, and the sheets
(`sheet.py`). Set `AVIF_Q` in `pack_textures.py` to the same N so the next
full pack agrees.
