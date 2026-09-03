# #107 — the hero headline on the splash

The hero headline is the page's largest text, so it is the LCP element —
and until now it painted only after the intro's gate. The static splash in
`index.html` now carries it from the first paint, in the hero's own box
(`src/features/intro/staticSplash.ts`, the box from
`src/features/stops/heroMetrics.ts`), composed with the ruled G mark on the
ink. At the handoff the mark and the ink go as before; the hero's h1, hidden
until then, takes the splash headline's place without a pixel moving and
settles the last 8 px (`heroRise.ts`, `handoff.ts`).

**Sign-off pending.** The composition is judged by eye and the user was
away during the run. The three options below were shot on both tiers
(`tools/shots/cdp-shot.mjs --splash`: 1600×900 at DPR 2, 390×844 at DPR 3,
about 300 ms after the document parsed, so the red rule has barely begun
its trace). The one shipped is **recto**; switching is one name in
`src/features/intro/splashComposition.ts` (`SPLASH_COMPOSITION_NAME`), and
`markOnly` there is the splash as it was, without the headline.

The headline's box is the same in every option — measured against the
hero's h1 with `--rects`, every line edge coincides to 0.00 px on both
widths, scripts blocked (the static markup alone) and with the bundle
mounted (IntroSplash's copy); fonts blocked, the fallback face's lines sit
0.00 px vertically and at most 9.55 px / 4.75 px horizontally from the web
font's, the same numbers as #106. Only the mark moves between the options.

## The options

| | desktop 1600×900 | mobile 390×844 |
|---|---|---|
| **recto** (shipped) | [recto-desktop.png](recto-desktop.png) | [recto-mobile.png](recto-mobile.png) |
| colophon | [colophon-desktop.png](colophon-desktop.png) | [colophon-mobile.png](colophon-mobile.png) |
| letterhead | [letterhead-desktop.png](letterhead-desktop.png) | [letterhead-mobile.png](letterhead-mobile.png) |

### recto — recommended

Desktop: the headline on the left page, the mark on the right, set at the
gutter and mid-height — a title page facing its frontispiece, the two
pinned to the frame's opposite gutters. The mark keeps 48 % of the
viewport's height, so the traced rule is still the brand sting, and its
travel into the nav corner is the short diagonal it always was. Mobile: the
sheet is a column — the headline's block, then the mark right-set under it
at the gutter, 8 svh below the last line: a seal after a signature, the
brand's own idea of the wax seal as the full stop.

Why, in the brand's terms: this is the expressive register done the quiet
way — ink ground, cream type, the one red element the rule — and it reads
as a printed spread rather than a splash screen. Cormorant at hero size is
the display face at the size it was drawn for. Nothing on the sheet is
centred that the page will not keep centred, so the handoff is a dissolve,
not a rearrangement: the words are where they stay.

### colophon

Desktop: the headline top-left, the mark bottom-right on the lockup's foot
line, the two pinning opposite corners of the frame. Mobile: the mark lower
right, over the band the lockup will occupy. It composes — the bookplate
diagonal — but on the wide viewport a 36 svh mark in the corner sits like a
sticker rather than a device, its weight low and off the headline's axis,
and the space between the two is dead ink. On the phone it is the same seal
after a signature as recto, only farther from the words. Second choice.

### letterhead

The mark small at the gutter over the headline, the way a device heads a
sheet of letter paper; mobile the same, in a column. The quietest of the
three and the closest to the everyday register — but at 11 svh the rule is
a two-pixel hairline and the trace, the brand's sting, is lost; on the
desktop the sheet is four-fifths empty ink with a stamp in one corner, and
on the phone the stack is top-heavy. Not classy enough for the hero
moment. Rejected.

### What was not shot

The mark as it was (72 svh, centred) with the headline in the hero's box:
the two collide at every width — the mark's box crosses the headline's
measure. And a centred stack (mark over a centred headline) would put the
headline where the hero does not keep it, so the handoff would have to
move it: the issue's "already in place" rules it out.

## What it does to the vitals

`pnpm lighthouse` on the built site (Lighthouse 12.6.1, median of three,
the same profiles as `docs/perf/lighthouse-baseline.md`):

| profile | LCP before | LCP after | FCP after | observed FCP → LCP |
|---|---:|---:|---:|---|
| mobile | 4165 ms (`section#hero > h1 > div.hero-line`) | 3035 ms | 2106 ms | 46 → 46 ms |
| desktop | 627 ms (`span.basis-full`, the lockup) | 567 ms | 449 ms | 33 → 33 ms |

The LCP element is the splash headline: on every run of both profiles the
observed LCP is the observed FCP to the millisecond — the h1 in the static
splash is the first contentful paint and the largest, and no later paint
displaces it (`PerformanceObserver` on a cold load reports exactly one
`largest-contentful-paint` entry, `h1[data-splash-headline]`, at the FCP
time, both tiers). The `largest-contentful-paint-element` audit reports
*not applicable* because that node is gone by the end of the trace (the
handoff removes the splash), so Lighthouse cannot name it. The simulated
LCP still trails the simulated FCP by ~0.9 s on mobile because Lantern's
estimate for a text LCP includes every response that had finished by the
observed LCP time — locally that is the whole shell chunk — not because
anything paints later.

For this to hold, IntroSplash no longer replaces the static splash with
its own markup: it adopts the static root and animates it. A re-created
h1, even in the same box, is a new candidate at mount time — measured
before the change: the only LCP entry landed at 108 ms (desktop) / 88 ms
(mobile) against an FCP of 40 / 68 ms, and Lighthouse's mobile LCP was
3382 ms.

## What to sign off

1. **recto** as the composition, or one of the others (one name in
   `splashComposition.ts`), or none — in which case `markOnly` reverts
   the splash and the LCP answer falls back to #113 alone.
2. The settle: 8 px, one second, the lines 80 ms apart, top line first
   (`HERO_SETTLE_*` in `heroRise.ts`); the splash headline lifts those 8 px
   over the handoff's 0.8 s as the ink dissolves, so the hero's lines pick
   up from where it left.
3. The mark's mobile gap below the headline (8 svh) and its width (46 vw);
   on desktop its height (48 svh) at the gutter.

## Re-shooting

```bash
pnpm build && pnpm preview --port 4408 --strictPort &
node tools/shots/cdp-shot.mjs --url http://localhost:4408/ --out shots/splash-desktop --size 1600x900 --dpr 2 --splash --label Hero --rects '[data-splash-headline]'
node tools/shots/cdp-shot.mjs --url http://localhost:4408/ --out shots/splash-mobile --size 390x844 --mobile --dpr 3 --splash --label Hero --rects '[data-splash-headline]'
```

Each writes `splash.png` and a `state.json` with the headline's line boxes
under the hero's label, to set against a `--labels Hero --rects h1` run of
the hero with `tools/shots/rectdiff.mjs … --x 0.5` (tools/README.md).
