# Components reorg — screenshot baseline (#85)

Reference captures for the zero-behavior reorg batch (#85–#93) dissolving
`src/components/` into feature + engine modules. Every issue in the batch
diffs its shots against these.

Captured from merge commit `b3b6920` (current main tip, post app-split).

> The Shape batch (#116–#134) ran on top of this one and settled the rules the
> tree below is now held to — the app store, the engine handle, the DOM
> contract, the token rules, the subscription hooks and the scans that enforce
> them. They are written down in
> [shape-decisions.md](shape-decisions.md); read that before changing any of
> them.

## Where the pixels live

The PNGs are not committed. They sit at:

```
/private/tmp/claude-501/-Users-josephhanson--herdr-worktrees-grace-city-collective-worktree-brave-field-c190/ec8e17f5-9b40-4e2d-acc1-625742014700/scratchpad/reorg-baseline/{desktop,mobile}
```

Regenerate them from b3b6920 with the commands below if that directory is gone.

## Capture parameters

```
pnpm build && pnpm preview --port 4381 --strictPort
node tools/shots/cdp-shot.mjs --url http://localhost:4381/ --out <OUT>/desktop \
     --port 9241 --size 1600x900 --dpr 2 --ids devotions,beliefs,faq,messages
node tools/shots/cdp-shot.mjs --url http://localhost:4381/ --out <OUT>/mobile \
     --port 9241 --size 390x844 --mobile --dpr 3 --menu --ids devotions,beliefs,faq,messages
```

Ten shots per width (six stops + four long-form sections) plus `menu.png` on
mobile — 21 PNGs total. `--dpr 2` is required on desktop or `tierFor()` picks
the mobile tier.

## How to diff

`node tools/shots/pngdiff.mjs <baseline.png> <candidate.png>` — exits 1 when
the share of pixels with any channel delta over 8 exceeds 0.5%.

Self-diff of this baseline against itself is 0 on all 21 shots. Noise-floor
notes from the app-split baseline still apply: mobile who-we-are /
house-churches can spike past the gate when SharedLife rows are caught
mid-print — eyeball before counting those as failures. Long-form shots are
pixel-exact.

## Final tree (#93)

The batch dissolved `src/components/` into feature + engine modules:

```
src/
  main.tsx  index.css  vite-env.d.ts  assets/ test/
  app/       # composition root: App, HomePage, initApp, jump, styles
  state/     # the app store (zustand) + the window.__gcc tooling seam
  engine/    # the Three.js renderer; index.ts is the repo's ONE barrel
             #   (PentecostParallax, StaticPoster, vignetteCss)
  device/    # Three-free capability policy: tier, preload, gyro, fallback,
             #   maskBounds, textureManifest, reducedMotion
  theme/     # design vocabulary, leaf layer: tokens, layerSplit, glass,
             #   interact, lozenge
  marks/     # brand-mark family: Seal, Lockup, CollectiveScript, GMark,
             #   GatheringMark, SowingMark + their geometry/metrics
  ui/        # shared presentational primitives + generic hooks:
             #   Reveal, SmoothHeight, watch (useSyncExternalStore shape),
             #   useInView (+ useInViewOnce), useInTurn, useMeasure,
             #   CornerOrnaments, OrnateRule, panel/
  features/  # the vertical slices, one folder per feature
    nav/       # SiteNav, NavLinks, MobileNav, DotRail
    stops/     # scene stops + their single-use widgets
               #   (GatheringCalendar, HouseTable, SharedLife, WayIn)
    longform/  # long-form sections + ScriptureRefs
    intro/     # splash + intro choreography
  scroll/ layout/ content/ lib/   # unchanged
```

## Layering rule

Dependencies point downward only:

```
lib, theme  →  device  →  state  →  scroll, layout, content  →  engine, marks, ui
            →  features/ (intro, stops, longform, nav)  →  app
```

- `state/` (#117) is the app store (`appStore.ts`: intro, introPlayed,
  reducedMotion, tier, fallback, progress, ready, sceneError, activeId,
  sceneInView) and the tooling seam (`seam.ts`, `window.__gcc`). It sits just
  above `device` because it holds a `Tier`; everything from `scroll` up may
  read and subscribe to it, and `app` alone decides its state
  (`app/initApp.ts`). Refs and DOM handles never go in it — the three
  registries beside it are the documented exceptions. `tier` (#118,
  `syncTier.ts`) and `reducedMotion` (#132, `syncReducedMotion.ts`) stay live
  after init on the `sync*` shape, while what the mount decided stays decided:
  the scene keeps the tier it mounted with (`app/HomePage.tsx`) and the poster
  is never swapped in for a running scene. Full rules:
  [shape-decisions.md](shape-decisions.md).

- Verified against the imports at the Shape tip, three edges point upward and
  are the rule's exceptions: `theme/layerSplit.ts` takes `TierName` from
  `device/tier.ts` and `state/appStore.ts` takes `SectionId` from
  `content/site.ts` (both type-only); and `features/nav/useNavigate.ts`
  reads `app/useJumpTo.ts`, since the jump context is the app's to provide.
  `content/` imports nothing at all.

- The engine is consumed only via `@/engine`; there are no other barrels.
- Import convention: `@/` for cross-directory imports, `./` within a
  directory.
- Exception: `vite.config.ts` loads `src/features/intro/staticSplash.ts` at
  config-load time, before the `@` alias exists — that graph (staticSplash,
  splashMark, introKeys, device/reducedMotion, marks/gMarkGeometry) keeps
  relative imports and stays Node-safe.
