# Grace City Collective — conventions

A single-page React 19 + Vite 8 + Tailwind 4 site with a three.js parallax
scene. Repo-specific rules only; the reasoning behind each is in
[docs/refactor/shape-decisions.md](docs/refactor/shape-decisions.md).

## Layering

Dependencies point downward only:

```
lib, theme → device → state → scroll, layout, content
           → engine, marks, ui → features (intro, stops, longform, nav) → app
```

- `@/` for cross-directory imports, `./` within a directory. The Node-safe
  graph `vite.config.ts` loads at config time (`features/intro/staticSplash.ts`
  and what it reaches) keeps relative imports and stays DOM-free.
- `@/engine` is the repo's only barrel. The four upward edges that exist are
  listed in [docs/refactor/reorg-baseline.md](docs/refactor/reorg-baseline.md);
  do not add a fifth.

## State

- `src/state/appStore.ts` (zustand) holds the session's facts and nothing
  else: intro, introPlayed, reducedMotion, tier, fallback, progress, ready,
  sceneError, activeId, sceneInView. `app/initApp.ts` decides them once per
  mount; everything from `scroll` up may subscribe.
- **No refs, DOM elements or functions in the store.** The documented
  exceptions sit *beside* it: `state/revealTargets.ts` (the intro's targets),
  `scroll/sections.ts` (the section registry), `app/jumpContext.ts` +
  `JumpProvider.tsx` (the page's jump).
- A live browser fact gets one `state/sync<Fact>.ts` — one media query, one
  action, an unsubscribe returned, run from an `App` effect
  (`syncTier.ts`, `syncReducedMotion.ts`). A live fact must never
  retroactively change an init-time decision: the poster (`fallback`) and the
  scene's tier are the mount's and stay the mount's.
- `window.__gcc` (`state/seam.ts`) is the app's one global, for `tools/` only.

## DOM

- Elements reach code as refs or through a registry; nothing queries the
  document. `useSceneLayers` owns the scene's refs, `scroll/sections.ts` the
  sections', `state/revealTargets.ts` the intro's.
- Visual state is a class (`STATE`, `NAV_REVEAL`, `NAV_GLASS` in
  `src/theme/classes.ts`), **not** a `data-*` attribute. What `data-*` remains
  — the static splash's hooks, test and tool seams, a few pre-existing CSS
  hooks, the marks' part names — is listed in shape-decisions.md.
- Tests assert roles, text and `toHaveClass`. Zero-change refactors prove
  themselves against the DOM pins (`features/stops/__snapshots__/`,
  `src/test/leafPins.test.tsx`, `features/longform/__fixtures__/`); a pin
  moves only with a shot gate showing the pixels did not.

## Theme

`src/theme` is the one home for shared visual constants, and
`theme/oneHome.test.ts` fails if one escapes.

- One easing (`--ease-site`); durations are `--duration-*` in `index.css`
  mirrored by `theme/motion.ts` with a parity test. One breakpoint: `LG_PX`
  (`theme/breakpoints.ts`). Shared measures are `VwClamp` triples in
  `theme/measures.ts`, each a `--spacing-*`.
- Shared class strings are cva bundles in `theme/classes.ts`. There is no
  merge step (tailwind-merge is gone): a caller's utilities follow a bundle's,
  and a bundle carries nothing the caller is expected to override.
- `theme/cssVars.ts` is the one typed way to set a CSS custom property.

## Engine

- `engine/createParallaxScene.ts`: `(canvases, config, options, env) →
  { setOptions, dispose }`. Config is read once, options are live, and
  `SceneEnv` (`engine/sceneEnv.ts`) is the only place a window, document or
  WebGL is touched.
- `engine/PentecostParallax.tsx` is the wrapper, pinned three-free and under
  90 lines. Props are tuning; session facts come off the store and reach the
  running scene through `setOptions` (`reducedMotion` is the example).
- Failures go `SceneConfig.onError` → `reportSceneError` → the store's
  `failScene`; `HomePage` shows the poster, `app/SceneBoundary.tsx` catches a
  throw. Vanilla three stays: the react-three-fiber spike (#134) is a no-go
  pending the human (`git show r3f-spike:docs/design/issue-134/README.md`).

## Hooks

- `ui/watch.ts` (`createWatch`) + `ui/useWatch.ts` (`useSyncExternalStore`) is
  the one shape under anything that watches an outside source.
- `ui/useInView.ts` is the one observer hook and the one definition of "on
  screen"; it returns `[attach, inView]` with a ref callback. `useInViewOnce`
  and `useInTurn` compose it; `ui/useMeasure.ts` is the one measuring hook.
- No effect lists a ref object in its dependency array; no cleanup sets state
  (`src/effects.scan.test.ts`).

## Machines

`scroll/pager.ts` and `features/intro/introMachine.ts` are pure transitions
over explicit state, tested without a DOM; a controller beside each carries
the effects out. One ScrollTrigger set (`scroll/sectionWatch.ts`) feeds both
the pager and the store's `activeId` — do not create a second.

## Scans

A browser API read in more than one place gets a scan test, and its exceptions
are documented in its own doc comment (a stale exception fails too):
`src/test/typesSweep.test.ts`, `src/test/modulesSweep.test.ts`,
`src/theme/oneHome.test.ts`, `src/features/intro/intro.scan.test.ts`,
`src/test/reducedMotion.scan.test.ts`, `src/effects.scan.test.ts`,
`src/test/memoLeaves.test.tsx`, `src/test/leafPins.test.tsx`.

## Gates

```
pnpm lint && pnpm knip && pnpm test && pnpm build && pnpm test:build \
  && pnpm budget && pnpm paint
```

plus `pnpm lighthouse` and the shot gate (`tools/shots/cdp-shot.mjs` +
`pngdiff.mjs`, default 0.5 %, one documented widening at 0.75 % for the AVIF
path's mobile hero; desktop shots need `--dpr 2`). `pnpm paint` reads the
browser because Lighthouse's simulated mobile LCP is bimodal here — see
[docs/perf/vitals.md](docs/perf/vitals.md). Raise a budget ceiling only in a
PR that says why.

## Pointers

[docs/refactor/](docs/refactor/) (shape-decisions.md, reorg-baseline.md,
app-split-baseline.md), [docs/perf/](docs/perf/) (wire-batch.md, vitals.md,
main-thread-slices.md), [tools/README.md](tools/README.md) (shots, transfer,
budget, paint, and the `window.__gcc` seam).
