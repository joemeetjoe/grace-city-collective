# Issue #26 — image budget

`tools/recut/pack_textures.py` turns the recut outputs in `tools/recut/dist/`
into the two shipped tiers, `public/dore/2048/` and `public/dore/1024/`.

## Sizes

Before: `public/dore/` was 7.7 MB flat (plate.jpg 1.2 MB, plate-backdrop.png
3.7 MB, map-crowd.jpg 1.2 MB, eleven map-fig JPEGs 1.5 MB, 32 mask PNGs + 12
depth PNGs 0.3 MB).

| tier | bytes | `du -sh dist/dore/<tier>` | budget |
|------|-------|---------------------------|--------|
| 2048 (desktop) | 2.17 MB | 2.5M | ≤ 2.5 MB |
| 1024 (mobile)  | 0.79 MB | 984K | ≤ 1 MB |

Desktop breakdown: plate 388 kB, backdrop 581 kB, crowd map 238 kB, eleven
figure maps 657 kB, nine mask packs 111 kB, twelve depth maps 191 kB.

What got it there, in order of effect:

- **WebP q80** for every colour texture (was PNG / JPEG q85–88).
- **Hollowing**: a colour texture is only sampled under the masks of the cuts
  that use it — a figure map under its own mask, the plate under the cuts
  that have no map of their own (arch, floor, dove, fig1, fig13, the flames).
  Everything else is replaced by a blur of itself, 12 px kept past the mask,
  so the encoder spends nothing on pixels that are never drawn. The plate
  went 929 → 388 kB, the figure maps 996 → 657 kB, with the drawn pixels
  byte-identical to a plain encode. The backdrop stays whole: it is what
  shows through when a cut moves.
- **Crowd crop**: `map-crowd` was the whole plate; it now covers only the
  rows its mask touches and carries a `mapRect` like a figure map.
- **Mask packs**: 32 single-channel PNGs → nine lossless RGBA WebPs, four
  masks per file (`masks-flame-<n>`, `masks-cut-<n>`, the figures nearest
  first so one preload covers the hero's foreground apostles). Encoded with
  libwebp's `exact`, or it zeroes RGB under a zero alpha and three masks
  vanish wherever the fourth is empty.
- Depth: lossless WebP.

## Codec: WebP, not AVIF

`pack_textures.py --compare` writes `crops-{plate,backdrop,map-fig5}.png` —
a 400×300 crop of dense hatching from each, 2× nearest-neighbour, source
beside WebP q80 and AVIF q60/q70 — and prints the bytes of the wider set.

| crop | source→ | WebP q80 | AVIF q60 | AVIF q70 | AVIF q80 |
|------|---------|----------|----------|----------|----------|
| plate     | 1215 kB jpg | 907 kB, HF 1.06 | 509 kB, HF 0.93 | 736 kB, HF 0.97 | 941 kB |
| backdrop  | 3735 kB png | 568 kB, HF 1.05 | 329 kB, HF 0.92 | 478 kB, HF 0.96 | 643 kB |
| map-fig5  |  219 kB jpg | 148 kB, HF 1.01 |  83 kB, HF 0.86 | 122 kB, HF 0.95 | 152 kB |

(bytes are for the whole texture at 2048, before hollowing; HF is the crop's
Laplacian energy relative to the source — under 1 is smoothing, over 1 is
ringing.)

Verdict: **WebP q80**. At 4× the isolated dots of the cross-hatch between
the engraved lines are where the codecs part: WebP keeps them (a touch of
ringing, which on line work reads as crisp); AVIF q60 visibly merges them
into grey, q70 dims them, and by q80 — where AVIF matches WebP's line
contrast — it is no smaller than WebP. AVIF is not shipped and the runtime
loads `.webp` only.

## Runtime

`cuts.json` in each tier has the same shape; every entry gains
`mask: { file, channel }` and map/depthMap names end in `.webp`. The loader
shares one texture per mask file (an `ImageBitmap` decoded with
`premultiplyAlpha: "none"`, so RGB under a zero alpha survives the upload)
and the fragment shader reads `dot(texture2D(mask, uv), uMaskChannel)`.
The desktop tier is loaded unconditionally; the tier switch is #34.

Before/after screenshots at every waypoint differ by a mean of 0.6/255
with no pixel off by more than 20 — codec noise, no seam, no missing layer.
