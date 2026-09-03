# Shape batch (#116–#134): the decisions

Nineteen slices, 2026-09-01/02, on top of the Vitals batch
([../perf/vitals.md](../perf/vitals.md)). The batch is a React refactor: the
audit it works from is at
<https://claude.ai/code/artifact/0dc03aaa-c178-4b45-811f-12582153ee38>.

Every slice was a zero-behaviour change proved by the DOM pins and the shot
gate, and each commit body says what it decided. This page is the short
version, written so the next batch does not undo any of it. Where a rule has
an exception, the exception is named — an undocumented one is a regression,
and in most cases a scan test fails on it.

The accessibility sweep (#130) lands in the same batch, in parallel with this
page: fourteen findings — a labelled nav landmark with list semantics, the
dot's visible text as its accessible name, focus-visible on the sheet's links
and a real dialog description, both mark links named "Home", motion-safe
guards, the page inert under the splash with the skip announced, focus kept
on a way-in arrow when it disables, the way-in step announced through a live
region updated in place, and a keyboard and touch path for the hover-lit
ornaments. It pairs with the axe gate from Vitals #112; the kicker's colour
contrast is left as a brand decision (below).

---

## The app store

`src/state/appStore.ts` (zustand) holds the facts that are global to the page,
and nothing else:

| fact | what it says |
| --- | --- |
| `intro` | the splash is still up |
| `introPlayed` | the intro played this mount and its handoff has landed |
| `reducedMotion` | the visitor prefers reduced motion |
| `tier` | the asset tier the device reads as |
| `fallback` | the still poster stands in for the scene |
| `progress` | the textures' share so far, 0–1 |
| `ready` | every texture (or the poster) has arrived |
| `sceneError` | why the scene gave up, or null |
| `activeId` | the section under the viewport's midpoint |
| `sceneInView` | the scene is on screen |

`app/initApp.ts` decides a mount's state once, from a lazy `useState`
initialiser, before any subscriber exists. Everything from `scroll` up may
read and subscribe; the app alone initialises.

**What may not go in it: refs, DOM elements, functions.** A ref stays with the
hook that owns it (`app/useSceneLayers.ts` is where every scene ref
originates). There are three documented exceptions, and each is *beside* the
store rather than in it:

- `src/state/revealTargets.ts` — a registry of the elements the intro
  animates (links, actions, dots, glass, the nav's mark, the hero headline,
  the parallax canvases). Components register through ref callbacks;
  `navReveal.ts` and `handoff.ts` read it in document order. Nothing here is
  reactive and no component reads it: it lives beside the store as the one
  module sibling features may all import, so the intro never finds a target
  by selector.
- `src/scroll/sections.ts` — `createSectionRegistry(order)`: the callback ref
  a `<section>` mounts with, and `sections()` for whoever needs the elements
  (the section watch, the pager, the engine's camera waypoints). The registry
  is the one place the DOM and the modules over it agree on which element a
  section is.
- `src/app/jumpContext.ts` + `JumpProvider.tsx` — the jump needs the page's
  scroll, which only the app holds (`useSmoothScroll`), and the store holds
  facts, never functions. So the app provides the jump it built (`app/jump.ts`)
  through context and the links read it through `useJumpTo`, by way of
  `features/nav/useNavigate.ts`. The context's default is a working native
  jump, so a link renders without a provider (a test).

`src/state/seam.ts` (`window.__gcc`) is the app's one global, and it is for
the tools only: `store` (getState/subscribe), `scrollTo` while a smoother
runs, and `scene` under `VITE_SCENE_DEBUG`. It ships in production because
the shots and the transfer trace run against the built site. See
[tools/README.md](../../tools/README.md), "The `window.__gcc` seam". Nothing
in `src/` reads it.

### The `sync*` convention

One module per live browser fact, subscribing one media query and calling one
action:

- `state/syncTier.ts` — `subscribeTier` (device/deviceProfile.ts) →
  `setTier(readTier())`
- `state/syncReducedMotion.ts` — `subscribeReducedMotion`
  (device/motionPreference.ts) → `setReducedMotion`; the same module's
  `readReducedMotion` is what a mount decides over

Each returns its unsubscribe; `App` runs both as effects. A new live fact gets
its own `state/sync<Fact>.ts` on this shape.

**The counterpart rule: a live fact must not retroactively change an
init-time decision.** The poster is the worked example. A mid-session flip to
reduced motion rests the ornaments, gives the smoother back to native scroll,
stops the engine's idle drift through `setOptions`, and brings a splash still
up down (the page then opens from ink, nothing marked played). It never swaps
a running scene for the poster: `fallback` is read once at the mount
(`device/fallback.ts`) and never again. The same rule governs the tier — the
fact goes live, but the scene keeps the tier it mounted with and its textures
are cut for that one (`app/HomePage.tsx` pins it), so no texture reloads
mid-session.

---

## The engine handle

`src/engine/createParallaxScene.ts`:

```ts
createParallaxScene(canvases, config, options, env) → { setOptions, dispose }
```

- **`config` is read once** when the scene builds: tier, ray and ember counts,
  the sections accessor, the scroll accessor, the progress/ready/error
  callbacks, the debug hook.
- **`options` are live**: a `setOptions` call marks a frame and wakes a parked
  loop. `SceneOptions` (engine/tick.ts) is the tuning surface —
  `layerSpread`, `figureRelief`, `beamGlow`, `flameDrift`, `idleDrift`,
  `orbitYaw`, `orbitPitch`, `reliefMax`, `reducedMotion`.
- **`env: SceneEnv`** (engine/sceneEnv.ts) is the only place the scene touches
  a window, a document or WebGL: `createRenderer`, `viewport`, `scrollTop`,
  `supportsAvif`, `now`, `raf`, `caf`, and `input: SceneInput` (engine/input.ts,
  the only listener). `browserEnv()` is the page's; a test hands in fakes.
  The factory's public surface names none of them.
- **Sections arrive by ref**, through the registry above. Nothing in the
  engine queries the document.
- **Errors go one way**: `SceneConfig.onError` → `engine/sceneError.ts`
  `reportSceneError` → one `[gcc] scene failed:` console line →
  `failScene(message)` on the store, which also sets `ready` so the splash
  opens on time. `HomePage` renders `StaticPoster` when `fallback || sceneError`
  and drops the front canvas with it; `app/SceneBoundary.tsx` (a class — React
  19's only way) catches a throw out of the lazy chunk or the render and
  reports it the same way. Without a listener the factory throws as before,
  and a failed mount hands back an inert handle.

**Props are tuning, the store is the session's facts, and the wrapper bridges
them through `setOptions`.** `reducedMotion` is the worked example: it is
`Omit`ted from `PentecostParallaxProps`, read off the store at mount, and a
store flip reaches the running scene through a `useAppStore.subscribe` in the
wrapper. A new session-wide fact the scene must follow goes the same way — a
store field and a `setOptions` bridge, not a prop threaded down.

**The wrapper's pins.** `src/engine/PentecostParallax.tsx` is held three-free
and under 90 lines by its own test. Both are load-bearing: the three-free pin
keeps `WebGLRenderer` out of the shell chunk, and the line pin is what caught
a named type pushing the file over. It is 86 lines now — a change that needs
more room needs a reason in its commit.

### Why vanilla three stayed

`#134` spiked react-three-fiber under the extracted engine on branch
`r3f-spike`, which is never merged; the deliverable is its page:

```
git show r3f-spike:docs/design/issue-134/README.md
```

**Recommendation: no-go. Recorded here as pending the human's decision**, with
the numbers:

1. **Bytes.** The engine chunk goes 114.9 → 198.5 kB brotli (+84 kB, +73 %),
   the js row 252.3 → 336.0 kB against the 262 kB ceiling — **74 kB over**.
   Even at fiber's floor (no `<Canvas>`, `createRoot()` on both canvases, so
   three is tree-shaken again) it is 291.7 kB, **30 kB over**. The reconciler
   alone is ~46 kB brotli, more than the whole budget headroom.
2. **The gate opens ~300 ms later.** Suspense's all-or-nothing resolve moves
   every texture upload behind the last landing, undoing #104's interleaved
   warm-up: `ready` follows the last texture by 18–33 ms today and by
   312–340 ms under fiber, and the splash leaves ~280 ms later on both tiers.
3. **Fiber cannot own the loop here.** The two-canvas split, the pacer's
   per-frame veto, the render gate and the scroll ratio all need
   `frameloop="never"`, priority `useFrame`s that bypass fiber's own render,
   and one external rAF loop — which is the vanilla engine with fiber as a
   canvas-and-renderer factory underneath it. The parts fiber is good at
   (declarative graphs React state drives, events, raycasting, drei) are the
   parts this scene does not use.

The pixels matched (0.05 % at the hero) precisely because nothing that draws
changed, and frame time was a wash. What would change the answer: a second or
interactive scene, a Wire budget re-cut with ~50 kB of framework headroom, or
fiber dropping its bundled reconciler (it cannot).

---

## The DOM contract

**Elements reach code as refs or through a registry. Visual state is a class.
`data-*` is not app logic.**

- Refs: `useSceneLayers` owns the scene's; `scroll/sections.ts` owns the
  sections'; `state/revealTargets.ts` owns the intro's targets. No module in
  `features/intro` queries the document (`intro.scan.test.ts`), and nothing
  selects `section[data-screen-label]` to find a section any more.
- State classes: `STATE` in `src/theme/classes.ts` — `is-lit` on a drawing's
  root, `is-on` on a filled tile or the current step, `is-walked` on a step
  behind the traveller, `is-drawn` on a walked span of the rule — plus
  `NAV_REVEAL` / `NAV_GLASS`, which the two `.intro-pending` rules in
  index.css now hang off. #123 and #125 removed 36 `data-*` attributes
  between them (the nav's eleven, the four ornaments' and their wrappers'
  twenty-five); index.css had no rule on any of them.

What remains, and why:

- **The static splash's own identity attributes** (`data-intro-static` and the
  hooks the build stamps on its parts, `features/intro/staticSplash.ts` /
  `staticSplashDom.ts`), queried only inside the adopted root. That markup is
  HTML the build emitted, not rendered, so nothing could have handed its parts
  over as refs. This is the one lookup `intro.scan.test.ts` allows.
- **Test and tool seams**: `data-screen-label` on a stop's `<section>`,
  `data-copy-panel` on `ui/panel/Bracketed.tsx`, `data-hero-headline` on the
  page's h1, `data-gathering` on a gathering card, and the scene's structural
  handles `data-scene` / `data-parallax` / `data-parallax-front` /
  `data-scene-frame` / `data-poster`. These are read by `App.test.tsx` and by
  `tools/`; they carry no behaviour.
- **CSS hooks that predate the batch**: `[data-reveal]` and
  `[data-smooth-scroll]` are keyed on directly in index.css, and
  `.intro-pending [data-hero-headline]` is what hides the rendered headline
  while the splash's own h1 paints. `data-drawn` / `data-shown` on
  `OrnateRule`, `CornerOrnaments` and `Kicker` are left over from before the
  batch and nothing keys on them — fair game for the next sweep.
- **The marks' own attributes** (`data-seal`, `data-lockup`, `data-g-mark`,
  `data-gathering-mark`, `data-sowing-mark`, `data-tile`, `data-lozenge` …).
  They name the parts of a drawing for its own tests and for the pins.

**Tests assert roles, text and `toHaveClass`** (`@testing-library/jest-dom`,
imported for vitest in `src/test/setup.ts`). The DOM pins are how a
zero-change refactor proves itself, and a moving pin needs a shot gate that
proves the pixels did not move:

- `src/features/stops/__snapshots__/scene-dom/` — every scene section in every
  state jsdom can reach (rest, lit, below lg, settled, hero pending), written
  at the untouched tip
- `src/features/stops/__snapshots__/ornaments/` — the four ornaments in 23
  states
- `src/test/leafPins.test.tsx` — a sha256 of each mark's, ornament's and
  Reveal's `container.innerHTML` as rendered at the untouched tip
- `src/features/longform/__fixtures__/longform.dom.html` — the long-form DOM
  node for node, text runs included

---

## The token rules

The theme is the one home for the site's shared visual constants, and
`src/theme/oneHome.test.ts` forbids a Tailwind class string or a timing
constant escaping it.

- **One easing.** `--ease-site` in index.css; `EASE_SITE_POINTS` /
  `EASE_SITE` in `src/theme/motion.ts`. The curve is written once (32
  `cubic-bezier(` occurrences went to 1).
- **Durations as `--duration-*`**, mirrored in `motion.ts` and held in sync by
  `motion.test.ts`: every name in `CSS_DURATIONS` must exist in index.css with
  the same number, so a CSS transition, a Tailwind `duration-*` utility and a
  gsap tween read one value. Delays, staggers and the tweens' seconds are the
  script's alone and live in `motion.ts` as plain values.
- **One breakpoint.** `LG_PX = 1024` in `src/theme/breakpoints.ts`, with
  `LG_QUERY` / `BELOW_LG_QUERY` beside it. CSS and script agree by
  construction.
- **Clamp measures** in `src/theme/measures.ts` as `VwClamp` triples, each
  `--spacing-<name>` in index.css and read by a Tailwind utility
  (`px-gutter`, `inset-frame-inset`, `p-panel-pad`, `pb-lockup-foot`);
  `measures.test.ts` keeps the two in step. The inline head style cannot read
  the variables (the stylesheet loads non-blocking), so it writes the clamp
  out from these points instead.
- **Class bundles via cva** in `src/theme/classes.ts` — `button`, `pill`,
  `stopHeading`, `stopBody`, `glass`, `manners`, `kicker`, `panel`, `TUCK`,
  `stopFrame`, `STACK`, the long-form and ornament-column bundles.
  **Override precedence is decided by construction: there is no merge step.**
  tailwind-merge went in #96, so a caller's own utilities follow a bundle's,
  and a bundle never carries a utility a caller is expected to override.
  `classes.test.ts` pins each bundle to the class list it replaced.
- `src/theme/cssVars.ts` is the one typed way to put a custom property in a
  style object.
- `motion.ts`, `breakpoints.ts`, `measures.ts` and `classes.ts` are DOM-free
  with relative imports only: `vite.config.ts` loads the inline-head graph
  (`features/intro/staticSplash.ts`) before the `@` alias exists.

---

## The subscription hooks

`src/ui/watch.ts` is the one shape under every hook that watches something:

```ts
createWatch<T>(initial, start: (set) => () => void) → { subscribe, getSnapshot }
useWatch(watch) → T          // useSyncExternalStore
```

The source starts for the first subscriber and stops when the last leaves; the
value survives a stop and a restart (StrictMode subscribes twice); a report
equal to the current value tells no one. A change of inputs makes a **fresh**
watch from its initial value.

- **`useInView`** is the one observer hook, and the one place "on screen" is
  defined: `threshold` (a number, or a function of the element resolved as the
  watch starts), `rootMargin`, `initial`, `once`, `enabled`. It returns a
  **tuple** `[attach, inView]` with a ref *callback*, so the element is state,
  not a ref read during render. `PLAY_BAND` / `PLAY_MARGIN` express the phone's
  play band as shares of the viewport cut off each edge — deliberately not a
  share of the target, which a panel taller than the band would never reach.
- **`useInViewOnce`** and **`useInTurn`** are compositions, not parallel
  implementations: the first is `useInView` held at its first yes with
  `cappedThreshold` (so a tall block comes in once about half a screen shows,
  never later) and `initial: true` where there is no observer or it is
  disabled; the second is a watch over timers.
- **`useMeasure`** is the one measuring hook: a layout effect on the attached
  element, re-read on every `ResizeObserver` report (a window resize where the
  observer is missing). `read` must be stable — a new function is a fresh
  measure.
- **The rule: no effect lists a ref object in its dependency array, and no
  cleanup sets state.** `src/effects.scan.test.ts` is the lint. When a fact
  from an observer must outlive the mount's churn it goes to the store and the
  next mount's `init` puts it back to rest — `useSceneLayers`' `sceneInView`
  is the example.

---

## The scroll pager and the intro machine

Both are pure transition functions over an explicit state, tested without a
DOM. Where a machine has to touch the world, a controller beside it carries
the effects out.

- **`src/scroll/pager.ts`** — wheel accumulation, touch arming, hold and
  release, the turn queue, the settle. State and inputs in, next state and a
  list of effects out. `attachPager.ts` carries them out (the proxy tween, the
  touch Observer, the scene trigger, the native scroll-by), and
  `useSmoothScroll` is three thin effects over the refs it is given.
- **`src/features/intro/introMachine.ts`** — phases `idle → tracing →
  handing-off → done` over the gate's three inputs (`loaded`,
  `minimumElapsed`, `skipped`); a transition hands the same object back for a
  no-op, so a repeat input, a skip during the handoff or anything after the
  landing changes nothing. `createIntroController` runs it outside React;
  `IntroSplash` is one layout effect that adopts the static root, hands its
  parts over, and disposes.
- **One ScrollTrigger set** — `src/scroll/sectionWatch.ts`, one trigger per
  section, active while the section spans the viewport's midpoint. It feeds
  both the store's `activeId` and the pager's layout (`boxes()`,
  `onMeasure()`). There is no second set: `useHashSync` subscribes to the
  store rather than making one.
- gsap plugins are registered idempotently by the modules that use them;
  `src/lib/gsap.ts` exports the core alone.

---

## The scans that enforce all of this

**The convention: a browser API read in more than one place gets a scan test,
and its exceptions are documented in its own doc comment.** Each scan reads
`src` as text, not types, so every rule carries the exceptions it cannot see
past — and a *stale* exception fails too, which is what keeps the list honest.

| scan | what it forbids |
| --- | --- |
| `src/test/typesSweep.test.ts` | a list key that is not an id from the content or a static table; a non-null assertion; a single-valued string union; the React namespace where a type import will do. Exceptions: `features/intro` (until #124 landed) and the four ornaments. |
| `src/test/modulesSweep.test.ts` | a `.tsx` exporting anything but components and types; a context outside a `.ts`; any `eslint-disable`; a hook file not named after its hook; two exports of one name meaning different things; a `@/` alias inside the Node-safe graph vite.config.ts loads; an orphaned one-line JSDoc; an issue named as a consumer. |
| `src/theme/oneHome.test.ts` | a `*_MS` / `*_SECONDS` / `*_EASE` export outside `src/theme`; a Tailwind class string exported outside it; a second home for the curve, the measures or the breakpoint; a barrel in the theme (the engine's `index.ts` is the repo's only one). |
| `src/features/intro/intro.scan.test.ts` | any document query in the intro (bar the one inside the adopted static root); an eslint escape; the session flag read or written anywhere but `introPolicy.ts`; the static splash removed in more than one place. |
| `src/test/reducedMotion.scan.test.ts` | `matchMedia` called with the reduced-motion query anywhere but `state/syncReducedMotion.ts`. Exceptions are compile-time: the two head scripts that carry the query as text (`features/intro/staticSplash.ts`, `device/enginePreload.ts`) and the stylesheet, which follows the media query natively. |
| `src/effects.scan.test.ts` | a ref object in an effect's dependency array; a state setter called from an effect's cleanup. |
| `src/test/memoLeaves.test.tsx` | a memoised leaf re-rendering when a parent re-renders with equal props (render counts through `countRenders.ts`). |
| `src/test/leafPins.test.tsx` | the marks', the ornaments' and Reveal's DOM moving — a sha256 per recipe, taken at the untouched tip. |

---

## The gates

```
pnpm lint && pnpm knip && pnpm test && pnpm build && pnpm test:build && pnpm budget && pnpm paint
```

plus `pnpm lighthouse` and the shot gate. `pnpm test` is the unit project;
`pnpm test:build` runs against `dist/`. CI (`.github/workflows/ci.yml`) runs
lint, test, build and the budget on every PR and push to main.

The shot gate is `tools/shots/cdp-shot.mjs` + `tools/shots/pngdiff.mjs`:
the share of pixels with any channel delta over 8, **default 0.5 %**, with one
documented widening — `--max 0.75` for the AVIF path's mobile hero
(tools/README.md, docs/design/issue-101). Desktop shots need `--dpr 2` or
`tierFor()` picks the mobile tier. The known noise: mobile house-churches can
read ~0.47 % when its animation is caught mid-phase; eyeball before counting
it as a failure.

**Why `pnpm paint` exists.** Lighthouse's simulated mobile LCP is bimodal on
this page — Lantern prices the inline splash headline two different ways run
to run (755/2855 and 2107/6175 on the same commit), and probing single commits
across this batch lands in either mode with no pattern. The browser's own
number never moves: 27–47 ms on every run of both profiles. So mobile LCP
warns, and `pnpm paint` (`tools/perf/paint.mjs`) is the gate that holds #107's
promise — the largest paint must be the splash headline and must land inside
400 ms, on both profiles, read from a `PerformanceObserver`. Details and the
run tables: [../perf/vitals.md](../perf/vitals.md).

---

## Decisions pending the human

| what | where | the call |
| --- | --- | --- |
| react-three-fiber | `git show r3f-spike:docs/design/issue-134/README.md` | The spike recommends **no-go**: +84 kB brotli on the engine chunk (74 kB over the 262 kB ceiling, 30 kB over even without `<Canvas>`), gate-open ~300 ms later, and fiber cannot own the loop. Yours to accept or overturn. |
| the kicker's colour contrast | [../perf/lighthouse-baseline.md](../perf/lighthouse-baseline.md), [../perf/vitals.md](../perf/vitals.md) | Seal on ink, 2.42:1 at 11 px — mobile accessibility 96, the one red Lighthouse error assertion. A brand-colour call; the gate stays at 100 so the decision is forced. #130 leaves it open too. |
| #107's splash composition | [../design/issue-107](../design/issue-107) | `recto` shipped and is judged by eye; switching is one name. Sign-off pending. |
| #101's AVIF quality | [../design/issue-101](../design/issue-101) | q64, chosen by SSIM against WebP q80, not by eye. Re-encoding is one flag in dore-recut's pack step. |
| #108's `SITE_ORIGIN` default and its framing copy | `vite.config.ts`, `src/content/surfaces.ts` | The default is `https://gracecitycollective.com`, overridable at build. Four strings are new prose, not the site's own words: `WHOLE_SITE_LABEL`, `WHOLE_SITE_INTRO`, `WAY_IN_HEADING`, `LEAD_PASTOR_LABEL`. |
| #114's four main-thread slices | [../perf/main-thread-slices.md](../perf/main-thread-slices.md) | Drafted with measured costs, not filed. #114 closes when each is an issue. |
| #130's new copy, if any | the sweep itself | The accessibility sweep may add labels and live-region wording; anything new is a copy decision. |

---

## How to add a feature now

**Where a new fact goes.** If more than one module needs it and it describes
the session, it is a store field in `state/appStore.ts` with an action, and
`app/initApp.ts` decides its mount value. If it is a live browser fact, it also
gets a `state/sync<Fact>.ts` — one media query, one action, an unsubscribe
returned, run from an `App` effect — and it must not retroactively change an
init-time decision. If only one component needs it, it is local state. If it is
an *element*, it is a ref, or a registry beside the store (`revealTargets.ts`,
`sections.ts`) — never the store.

**Where classes come from.** `src/theme/classes.ts`. A class string worn by
more than one component is a bundle there (cva if it has variants), pinned by
`classes.test.ts`; a caller's own utilities go after it, and the bundle carries
nothing the caller is meant to override. Visual state is a `STATE` class, not
a `data-*` attribute. A new duration is a `--duration-*` in index.css and an
entry in `CSS_DURATIONS`; a new shared measure is a `VwClamp` and a
`--spacing-*`. `oneHome.test.ts` will fail if either escapes.

**Registering a stop.** Add the section to `src/content/site.ts` (a `SceneId`),
write `features/stops/<Name>Stop.tsx` standing in `Stop` (which gives you the
framed `<section>`, the `Bracketed` copy panel and the stop's `TUCK`), put its
words through `StopWords`, and add it to `STOPS` in
`features/stops/registry.ts` — `satisfies Record<SceneId, StopComponent>`
means a missing or spurious entry fails to compile. Ask `useStopPanel` what
lights the ornament; do not ask which device you are on. Pin the new section's
DOM under `__snapshots__/scene-dom/`.

**Reaching the pager and the engine.** A section reaches both through
`createSectionRegistry` (`scroll/sections.ts`): mount the `<section>` with
`sections.ref(id)` — `useSceneLayers` creates the registry in ids order — and
`sectionWatch.ts` picks it up, writing `activeId` and the boxes the pager
paces by, while the engine reads `sections()` for its camera waypoints. Nothing
selects for it.

**Which gate proves it.** A DOM change: the pins above, then the shot gate at
0.5 % on both widths. A bytes change: `pnpm budget` (raise a ceiling only in a
PR that says why — #102). A paint change: `pnpm paint`, and `pnpm lighthouse`
for the rest. A new global rule: a scan test, with its exceptions written into
its own doc comment.

---

## Where else to look

- [reorg-baseline.md](reorg-baseline.md) — the module tree and the layering
  rule
- [app-split-baseline.md](app-split-baseline.md) — the App split before this
  batch
- [../perf/wire-batch.md](../perf/wire-batch.md) — first-load bytes per tier
- [../perf/vitals.md](../perf/vitals.md) — Lighthouse, the paint gate, the
  ceilings
- [../../tools/README.md](../../tools/README.md) — the shot, transfer, budget
  and paint tools, and the `window.__gcc` seam
