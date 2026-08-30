# The wall behind the apostles, and the huddle

Two things the eye caught in the scene once the figures rode their own planes:

1. **Fragments floating in the wall.** The crowd map — the wall behind the
   apostles, `map-crowd.webp`, plate rows 0.396–0.82 — was the plate wherever
   no figure mask claimed the pixel, with the figure holes filled. SAM's masks
   undershoot in places, so a shoulder's edge here and a tuft of hair there
   survived outside the holes; once the figure slid off them at the dolly they
   floated in the wall. `band-before.jpg` is that map: hand outlines, head
   rims, robe edges, all without their figures.
2. **Hairline gaps between neighbours.** Every figure's alpha is eroded 2 px
   and feathered 3 px (issue #28), and the camera's lateral travel shears the
   planes apart, so where two robes touched on the plate a sliver of wall
   showed between them.

## The wall: synthesized, not cut

`tools/recut/ray_wall.py` replaces the whole band. Nothing of the plate
survives inside it, so no fragment can float, by construction — and no hole
ever needs sizing to a fragment again. The band is three factors:

- **carrier** — the engraving's hatch. A clean patch of bare wall (right of
  the beam, above the flames) divided by its local mean gives unit-mean lines
  with no tone; it is overlap-added across the width (rows stay rows, so the
  lines never jump), cut into blocks of a whole number of line pitches
  (`block_rows`, 53 rows = 8 pitches here) and stacked down the band in a
  seeded random order, the first block phased to the lines just above the
  seam (`seam_offset`). The floor hatch takes over below the pavement line.
- **guide** — the tone. `build_cuts.brightness_field` over the backdrop with
  the band as the hole: the beam, the vignette and the floor's tone continued
  into it, corrected at the seam to the rows just above (`seam_correction`),
  the correction decaying over 160 px.
- **raymod** — the rays. The clean strip above the flames (rows 0.12–0.32)
  blurred vertically only — the hatch averages away, the rays' vertical edges
  stay crisp — normalised to unit mean per row. Each band pixel samples the
  strip along its own ray from the dove (`radial_map`): the rays keep their
  angle and widen with depth exactly as Doré's do. The strip's left third is
  the gothic columns; the mirrored right side stands in.

`band = carrier · guide · raymod`, cross-faded from the backdrop over 24 px
at the band's top. The same pixels go into `map-crowd.jpg` and
`plate-backdrop.png` — one wall, on one plane, so wherever a cut moves off
them the two textures agree.

| | |
|---|---|
| `band-before.jpg` | the shipped crowd map |
| `band-after.jpg` | the synthesized band |
| `zoom-wall.jpg` | the wall between the heads at the community stop, before / after |
| `zoom-gap-right.jpg` | the right-hand figures at the community stop, pointer hard left (maximum shear), before / after |

What is given up: Doré's hand-drawn darkening of the wall next to each figure.
The band reads as open wall everywhere, which is also what a moved figure
should reveal.

`build_cuts.py --fill ray` (the default now) runs the same fill after the
LaMa ring, so a full recut reproduces it; `ray_wall.py` alone re-fills an
existing `dist/` in a second or two.

## The huddle

`HUDDLE = 0.04` in `src/components/parallaxRelief.ts`: every figure slides
toward the plate's centre line by 4 % of its centroid's offset from it, in
the plate's units at its live depth (`huddleShift`, applied per frame in
`PentecostParallax.tsx`). A flame rides its parent's shift, so it stays on
the head that moved. The centroids come from the shipped masks and ride in
`cuts.json` as `at`, like the flames' already did.

A rigid shift per figure is the only thing that closes a gap: a uniform
x-scale would scale the gaps along with everything else. Neighbours ~0.15
apart on the plate close by 0.6 % of the plate — ~12 px at 2048, a touch
more at the community dolly. The outer edge of each figure uncovers a sliver
of the crowd map instead, which is now open wall.

The figure rects the copy panels tuck against (`tools/shots/cdp-rects.mjs`,
1600×900, dpr 2, CSS px) move with them — the front figures at the stops
whose panels tuck behind them:

| stop | fig0 | fig5 | fig13 | fig10 | fig1 |
|---|---|---|---|---|---|
| hero | +28 | +16 | +13 | +2 | −17 |
| about | +29 | +16 | +12 | +3 | −17 |
| house churches | +51 | +30 | +26 | +5 | −32 |
| gatherings | +36 | +20 | +17 | +3 | −22 |
| give | +47 | +28 | +24 | +4 | −29 |
| visit | +78 | +52 | +49 | +9 | −52 |

The panels still sit behind the same figures in the shots; the TUCK values in
`App.tsx` were not re-fitted here.
