# Issue #29 — the band between the apostles and the upper section

A horizontal strip of foreign-looking wall shows above the heads as the camera
dollies in. `community-before.jpg` (the community waypoint, 16:9, pointer centred)
has it: a straight seam right across the frame a little under the flames, denser
hatching below it than above, and a dark smear under every flame.

## Where the strip actually comes from

Not from the backdrop's inpaint margin. An offline compositor with the scene camera
transcribed from `PentecostParallax.tsx` (now `tools/recut/dolly.py`) puts a source
id on every screen pixel of that frame: everything between the seam and the heads is
the **crowd** cut, showing plate rows 0.40–0.47 at 1.16× the backdrop's magnification.
The backdrop directly above the seam is showing row 0.411, the crowd directly below it
row 0.4035 — the crowd's straight top edge (v 0.40) is sliding across the backdrop's
hatching, out of register by 28 plate px, and a horizontally hatched wall drawn at two
scales meets along a full-width line. The dark smears are the crowd's flame windows:
the flames rise out of them mid-scroll and the windows show the backdrop's inpainted
flame holes.

So the seam is a modelling error, not a fill width: the crowd is the wall behind the
apostles and the backdrop is the same wall above them, but one sat at z −0.9 and the
other at −5.6.

## The geometry, in plate pixels

`dolly.py` mirrors the camera: every plane registers from (0, 0, baseZ); at scroll
progress *p* every authored z is scaled by `layerSpread + smoothstep(p) × 0.35`
(1.25 → 1.545 at the community section, 1.6 at give) and the plane rescaled so it
still registers. Away from the registration camera a nearer plane magnifies more
about the camera's aim. Community waypoint, pointer centred:

| plane | authored z | live z | magnification vs the wall, 16:9 | 4:3 |
|---|---|---|---|---|
| frontmost figure | 2.6 | 4.02 | 1.666 | 2.079 |
| backmost figure | 1.5 | 2.32 | 1.404 | 1.655 |
| crowd (old) | −0.9 | −1.39 | 1.162 | 1.262 |
| flame | −2.0 | −3.09 | 1.105 | 1.170 |
| arch | −2.8 | −4.33 | 1.074 | 1.119 |
| wall / backdrop | −5.6 | −8.65 | 1 | 1 |

(4:3 dollies deeper relative to registration: baseZ is 16.55 there against 12.42 at
16:9, and the community camera sits at z 8.0 in both.)

Slide of a figure at z 2.6 against the other planes, at 16:9 — the strip of the far
plane exposed at that row of the figure, all of it from inside the figure's own hole:

| figure row | vs arch (−2.8) | vs crowd (−0.9) | vs wall (−5.6) |
|---|---|---|---|
| a face, v 0.45 | 165 px | 130 px | 199 px |
| shoulders, v 0.52 | 263 px | 206 px | 317 px |
| its hem, v 0.78 | 624 px | 491 px | 753 px |

Worst case over every waypoint, both aspects and the nine pointer extremes that keep
a face row in frame (`worst_shear`): 243 px above a face against the wall, at the
community waypoint, 16:9, pointer top-left. The hem numbers never show — the floor
cut (z 3.6) is in front of them.

The crowd's own top edge against the wall, per waypoint at 16:9: −35, −14, +20, +28 px
(hero → community); the seam is there at rest on the hero too, just narrower.

## Fix: put the crowd on the wall's plane

`CROWD_Z = BACKDROP_Z` (−5.6, `dolly.py` mirrors it from the TSX). Two planes at one
depth share one mapping, and the masks are a partition of unity, so the crowd's band
edge is now invisible at every camera by construction — `shear_px(z, z, …)` is zero,
not small. Consequences, all handled by the existing ownership pass:

- Nothing sits behind the crowd any more, so the band is plain: no windows for the
  flames, arch or dove (`crowd_alpha()`, windows only for cuts with `z < CROWD_Z`).
  A rising flame now reveals the crowd map's own LaMa-ringed fill under its rest
  position instead of the backdrop's through a window.
- The figures shear against the wall instead of against a nearer crowd: the fill
  revealed above a face at the community dolly grows from ~130 to ~200 px (243 worst
  case), beside a figure from ~217 to ~333 px. All of it is inside the figure's hole
  in the crowd map, which is filled outright (tile fill, LaMa ring at the rim), so no
  margin has to be sized to the shear — there is no partially inpainted zone to run
  out of. That is also why `DILATE_PX` stays at 9: the backdrop is only ever revealed
  through a cut's own rest silhouette, which its hole covers entirely.
- `FIG_Z` (−0.7 … 2.6), `ARCH_Z` (−2.8) and `DOVE_Z` (−3.0) are unchanged. The figure /
  arch spread was not the seam, and compressing the figure band to keep the reveals
  at their old width would trade the parallax the scene was tuned on for ~70 px of
  fill nobody had objected to.

Rejected on the way: extending the crowd band up to the top of the plate at z −2.8
("continuous with the arch") moves the seam to the plate's top edge — 21 px out of
register in the vault at the give waypoint — instead of removing it.

## Verification

`community-after.jpg` is the same frame from the rebuilt assets. Checked with
`tools/shots/cdp-shot.mjs` at 1600×900 and 1200×900, pointer centred and at both
corner extremes, every waypoint: no seam or band above the heads.
