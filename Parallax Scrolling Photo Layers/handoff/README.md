# Dropping the parallax into grace-city-collective

Four steps. Nothing here needs a build plugin — just `three` and the assets.

## 1. Install

```bash
pnpm add three
pnpm add -D @types/three
pnpm add @fontsource/cormorant-garamond   # the display face
```

GSAP is **not** needed. Scroll progress is read straight off
`document.documentElement`, which turned out to be more reliable than
ScrollTrigger inside a transformed container.

## 2. Copy the assets

Copy this project's `assets/` folder into your app's `public/dore/`, renaming the
plate:

```
public/dore/plate.jpg              ← assets/dore-pentecost-dark-2048.jpg
public/dore/plate-backdrop.png     ← assets/plate-backdrop.png
public/dore/cuts.json              ← assets/cuts.json
public/dore/cut-*.png              ← assets/cut-*.png   (32 masks)
```

They go in `public/`, not `src/assets/`, because the component fetches
`cuts.json` at runtime and derives every mask URL from it — so adding or
re-cutting a layer never touches the code. Total ≈ 3.5 MB; they're greyscale PNGs
and compress well over the wire.

## 3. Copy the code

```
src/components/PentecostParallax.tsx   ← the scene (self-contained)
src/App.tsx                            ← the page (replaces yours)
```

`@/` already resolves to `src/` in your `tsconfig.app.json`, so the import works
as-is.

## 4. Two lines of CSS

Add to `src/index.css`:

```css
@import "@fontsource/cormorant-garamond/300.css";
@import "@fontsource/cormorant-garamond/400.css";

/* scroll settles on exactly one section at a time — safe as mandatory because
   every section is exactly one viewport tall */
html {
  scroll-behavior: smooth;
  scroll-snap-type: y mandatory;
  background: #14100e;
}
section[data-screen-label] {
  scroll-snap-align: start;
  scroll-snap-stop: always;
}
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
    scroll-snap-type: none;
  }
}
```

---

## How it works, in case you need to change it

**The cut.** `cuts.json` lists ~32 layers, each with a `z`. Every layer is one
quad sampling the same plate through its own greyscale mask. The masks are a
**partition of unity** — they sum to exactly 1 at every pixel — so at rest the
layers reassemble the engraving bit-for-bit. That's why the cuts have no visible
seams even though their edges are soft.

**Why there's a separate backdrop.** A cut that moves would leave a hole, so
`plate-backdrop.png` is the plate with every cutout inpainted back in (the wall
is even horizontal hatching, so the fill propagates along rows only — blurring
vertically destroys the line pattern and reads as a smudge). It sits on a much
larger plane at the same registration, so no camera position can reach past it.

**The camera.** One waypoint per `<section data-screen-label>`, in `WAYPOINTS`.
Each declares the **band of the plate it must contain** (in image `v`, 0 = top)
rather than a frame centre, and the distance is solved from that band. The solve
deliberately never uses `aspect` — that's what makes the crowd fill the frame
identically at 4:3, 16:9 and 21:9. A section holds its own frame for the first
55% and travels in the tail, so it isn't permanently en route to the next one.

**Two things that will bite you if you retune it:**

- Doré's plate has content at flames `v 0.26–0.42`, faces `v 0.42–0.52`, robes to
  `v 0.78`, and the dove at `v 0.033`. Between `v 0.25` and `v 0.10` there is
  only bare wall. Aim a waypoint there and the section frames nothing.
- The dove waypoint aims at the dove layer's *live* plane position, not a fixed
  image height, because a far layer's apparent position shifts with parallax. A
  hard-coded height frames it correctly at one aspect and misses at others.

**Props** on `<PentecostParallax>`: `layerSpread` (0.2–1.6, how far the planes
separate — 1.6 is a diorama), `beamGlow`, `flameDrift`, `idleDrift` (off by
default; on, the layers visibly swim against each other), `dollyIntensity`.

## Re-cutting the layers

The masks were generated from the plate itself, not drawn by hand: blur to an
ink-density map, take a column profile across the crowd, cut at the valleys
*between* figures, then multiply each mask by the ink so it hugs the drawn
silhouette. If you want different or finer figure groups, that generator is worth
porting to a small Node script rather than editing the PNGs — ask and I'll write
it out.
