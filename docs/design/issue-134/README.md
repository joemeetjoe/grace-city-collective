# #134 — react-three-fiber under the extracted engine: spike and recommendation

> **Superseded in part.** [`decision.md`](decision.md) (2026-09-03) re-measured
> this on the finished tree and reads the current docs: a deep port costs
> **+39 kB brotli, not +84** — most of the difference is `<Canvas>` defeating
> three.js tree-shaking. The conclusion holds; the numbers below do not.

**Decision: pending human decision. Recommendation: no-go** (keep the vanilla
engine behind `createParallaxScene()`), for the three reasons at the end.

This branch (`r3f-spike`, off `shape-batch` at 384ca10) is the spike itself.
It is never merged: the deliverable is this page. The default build is
untouched — byte-identical to the tip, hashes included (`index-CKOjim55.js`,
`PentecostParallax-Mo6whGB5.js`), `pnpm budget` unchanged, hero shot 0.0 %.

## What was built

The engine from #120 mounted under fiber 9.7 (three 0.185, React 19.2),
behind build literals so the default build folds it away and emits no chunk:

| build | flag | engine chunk |
|---|---|---|
| default | — | `src/engine/PentecostParallax.tsx` (unchanged) |
| fiber | `VITE_R3F=1 pnpm build` | `src/engine/fiber/ParallaxFiber.tsx` |
| fiber + drei | `VITE_R3F=1 VITE_R3F_DREI=1` | same, textures through `useTexture`, progress through `useProgress` |
| fiber, no `<Canvas>` | `VITE_R3F=1 VITE_R3F_CANVAS=0` | same, both roots through `createRoot()` on plain canvases |

`src/engine/fiber/`:

- `ParallaxFiber.tsx` — PentecostParallax's props and DOM contract. The back
  root is `<Canvas frameloop="never">` (or `createRoot()` on the component's
  own canvas under `VITE_R3F_CANVAS=0`); the front root is `createRoot()` on
  the page's existing front canvas, the one HomePage stacks over the copy.
  HomePage changes one line (`lazy(__R3F__ ? loadParallaxFiber : loadParallax)`).
- `SceneGraph.tsx` — under `<Suspense>` in the back root: `use(avifVerdict)`,
  then every texture through `useLoader` (sceneTextures.ts), then the vanilla
  factories (`buildLayers`, `createRayLayer`, `createEmbers`) build into one
  `THREE.Group` mounted as `<primitive>`. `useFrame(…, 1)` applies the frame
  plan (the vanilla tick's writes: `placeLayer`, uniforms, camera pose, the
  front row) and draws the back pass itself.
- `sceneLoop.ts` — the one external rAF loop: `tickFrame` with the render
  gate, the pacer and the parking kept whole, then `advance(now, false, root)`
  on the back root and the front root in turn. The scroll ratio goes through
  each root's `setDpr`.
- `sceneTextures.ts` / `sceneTexturesDrei.ts` — colour and depth maps through
  `useLoader(TextureLoader)` or drei's `useTexture`; the mask packs through
  `useLoader(ImageBitmapLoader)` with `premultiplyAlpha: "none"` in both
  variants (drei's `useTexture` cannot express that; a premultiplied upload
  wipes three of the four masks wherever the fourth is empty, textures.ts).
- `progress.ts` — the store's `setProgress` from `DefaultLoadingManager`
  (drei's `useProgress` is a zustand store over the same global's callbacks).
- `shared.ts` — what both roots and the loop share: one scene, one camera,
  the tick state, the plan in flight, the built objects, the per-side warmers.

Shared engine edits, type-only: `BuildContext.scene` and
`CreateEmbersOptions.scene` widened to `THREE.Object3D` (the spike hands a
Group); `engineChunkHref` takes the entry; `budgetReport.mjs` reads
`GCC_ENGINE_ENTRY`; the barrel exports `loadParallaxFiber` (its test updated).
Two dependencies added: `@react-three/fiber@9.7.0`, `@react-three/drei@10.7.8`
(peer ranges fit: fiber wants react ≥19 <19.3, three ≥0.156; drei wants
fiber ^9).

`docs/design/issue-134/measure.mjs` is the measurement script (frame cost and
gate-open, over the same hardware headless Chrome as `tools/shots/cdp-shot.mjs`).

## Bytes — the engine chunk against the Wire budget

`pnpm budget` on each build (js = shell chunk + engine chunk, brotli, the
same for both tiers; ceiling 262 kB per `tools/perf/budget.json`):

| build | engine raw | engine brotli | js total (kB) | vs 262 kB ceiling | desktop total (1950) | mobile total (960) |
|---|---:|---:|---:|---:|---:|---:|
| tip 384ca10 / default | 551 843 | 114.9 kB | 252.3 | 9.7 under | 1868.0 | 924.7 |
| fiber | 917 643 | 198.5 kB | 336.0 | **74.0 over** | 1951.7 (over) | 1008.4 (over) |
| fiber + drei | 918 454 | 199.0 kB | 336.5 | **74.5 over** | 1952.2 (over) | 1008.9 (over) |
| fiber, no `<Canvas>` | 701 665 | 154.3 kB | 291.7 | **29.7 over** | — | 964.1 (over) |

Where the +83.6 kB brotli (+366 kB raw) goes:

- fiber itself with its dependencies, bundled alone with react, react-dom
  and three external: **165.6 kB raw, 46.0 kB brotli** — `@react-three/fiber`
  243.7 kB minified (the vendored react-reconciler is most of it),
  `scheduler` 9.5, `use-sync-external-store` 5.4, `react-use-measure` 4.0,
  `its-fine` 2.3, `zustand` 2.2 (fiber's own copy: the app is on zustand 5,
  fiber imports `zustand/traditional`), `suspend-react` 2.0.
- the rest, ~38 kB brotli, is **three losing its tree-shaking**: `<Canvas>`
  calls `extend(THREE)` with the whole namespace as its element catalogue,
  so every class of three lands in the chunk (`AnimationMixer`,
  `AudioListener`, `CubeCamera`… absent from the vanilla chunk, present in
  the fiber one). The `VITE_R3F_CANVAS=0` build proves it: with both roots
  through `createRoot()` and no `<Canvas>` the chunk is back to tree-shaken
  three, and fiber's floor on this engine is **+39.4 kB brotli**.
- drei's two hooks cost 0.4 kB brotli when imported from their own files
  (`@react-three/drei/core/Texture.js`, `Progress.js`); the package's
  `sideEffects: false` holds. It brings a `zustand@4` copy into the lockfile
  that the bundle does not include.

Either way the js budget is breached: 74 kB over as the issue framed the
spike (`<Canvas>` per canvas), 30 kB over at fiber's floor. Every other row
of the budget is untouched (textures, fonts, css, html), so the desktop total
goes over by the same js delta only.

## Pixels — the hero and the give stop under fiber

`cdp-shot.mjs` at 1600×900 `--dpr 2` and 390×844 `--mobile --dpr 3`,
`pngdiff.mjs` (share of pixels with a channel delta over 8; the gate is 0.5 %):

| shot | tip vs shape-baseline | fiber vs shape-baseline | fiber vs tip (same session) | no-`<Canvas>` vs baseline |
|---|---:|---:|---:|---:|
| desktop hero | 0.0000 % | 0.0458 % | 0.0452 % | 0.0399 % |
| desktop give | 0.3702 % | 0.2805 % | 0.1383 % | 0.2800 % |
| mobile hero | 0.0002 % | 0.0026 % | 0.0039 % | 0.0017 % |
| mobile give | 0.0530 % | 0.0533 % | 0.0051 % | 0.0534 % |

Every fiber shot is inside the 0.5 % gate, and at the give stop inside the
tip's own run-to-run spread (the embers drift and the chases land a little
differently each session: the tip differs from its own baseline by 0.37 %
there). What differs at the hero (0.05 % desktop, max delta 85): the ember
field — the spike's `Points` sit on the same seed but the first drawn frame
comes one warm cycle later, so the dust has moved — and single-pixel edges
of the front figures, both canvases at the same size and ratio. Both
canvases are there (`state.json`: `canvas: true`, 2 contexts), the AVIF path
is taken, the tier is the intended one. No parity work was done beyond the
hero and give stops; the other four stops were not compared.

## Gate-open — when the intro may hand off

A first visit (the intro plays), 20 Mbps / 150 ms rtt so the textures are the
limiter, ms from navigation, two runs each (both agree within 20 ms;
the second run is shown):

| build, tier | engine landed | first progress | last texture landed | store `ready` | ready − last texture | splash gone |
|---|---:|---:|---:|---:|---:|---:|
| tip desktop | 333 | 718 | 1751 | 1768 | **18** | 2949 |
| tip mobile | 332 | 711 | 1754 | 1787 | **33** | 2968 |
| fiber desktop | 330 | 763 | 1753 | 2065 | **312** | 3232 |
| fiber mobile | 326 | 755 | 1745 | 2086 | **340** | 3253 |

The textures land at the same moment on both builds (same preloads, same
bytes: 54 files). What moves is what happens after the last one: the vanilla
engine warms each texture as it lands (`textureWarm.ts`, #104), interleaved
with the download, so `ready` follows the last texture by a frame or two.
Under Suspense nothing is built — and nothing can be uploaded — until every
texture has resolved, so the whole warm queue (54 textures, the shared masks
and depth twice, once per context) runs after the last landing at the tier's
`warmPerFrame`: ~300 ms later on both tiers, and the splash leaves ~280 ms
later. drei's `useTexture` does not help: it uploads all colour/depth maps
in one effect on the back root (one long frame, the thing #104 removed), and
the masks and the front context still queue. Fiber's `useLoader` cache is
also global and never disposes: textures survive the component's unmount
(good for StrictMode, a leak across a remount with a new tier).

## Frame time — the loop under motion

`measure.mjs --frames`: the pointer sweeps the viewport for 3 s (the orbit
chase keeps the loop at the tier's active rate) at the hero and at the give
stop; rAF deltas sampled in the page, and every rAF callback of a frame timed
(`requestAnimationFrame` wrapped before the page runs: the engine's tick and
its two draws plus gsap's ticker, CPU only). Headless Chrome, hardware GPU,
60 Hz.

Two runs each (~180 frames per window); the pair is shown as run 1 · run 2:

| build, tier, stop | rAF delta p50 / p95 (ms) | frames over 20 ms | main-thread per frame p50 (ms) | p95 | mean |
|---|---:|---:|---:|---:|---:|
| tip desktop hero | 16.7 / 16.7 | 0 % | 0.3 · 0.3 | 0.6 · 0.6 | 0.31 · 0.33 |
| tip desktop give | 16.7 / 16.7 | 0 % | 0.2 · 0.2 | 0.4 · 0.3 | 0.22 · 0.23 |
| tip mobile hero | 16.7 / 16.8 | 0 % | 0.1 · 0.2 | 0.6 · 0.4 | 0.26 · 0.18 |
| tip mobile give | 16.7 / 16.7 | 0 % | 0.2 · 0.2 | 0.7 · 0.4 | 0.25 · 0.19 |
| fiber desktop hero | 16.7 / 16.7 | 0 % | 0.4 · 0.4 | 0.5 · 0.7 | 0.36 · 0.43 |
| fiber desktop give | 16.7 / 16.7 | 0 % | 0.3 · 0.3 | 0.4 · 0.5 | 0.33 · 0.29 |
| fiber mobile hero | 16.7 / 16.8 | 0 % | 0.1 · 0.2 | 1.3 · 1.1 | 0.28 · 0.34 |
| fiber mobile give | 16.7 / 16.7 | 0 % | 0.2 · 0.2 | 0.6 · 0.7 | 0.22 · 0.27 |

The rAF deltas sit on the display's 16.7 ms for both builds at both stops
and both tiers, no long tasks in any window (an earlier pair of desktop
give-stop runs each had one ~100 ms frame at the scroll landing — the
front-row turn plus the ratio change — fiber 100 ms, tip 117 ms; neither
recurred). The main thread spends well under a millisecond per frame on
either engine on this machine; fiber costs ~0.05–0.1 ms more per frame on
average (`advance()` per root: a store read, the subscriber loop, the clock
bookkeeping, on top of the same `tickFrame` and the same two `gl.render`
calls) and its mobile-tier p95 is roughly double the tip's (1.1–1.3 vs
0.4–0.6 ms). Not a reason on its own either way: the frame budget is not
where this decision is made.

## The architecture questions the issue asked

**Two canvases.** Fiber's `<Canvas>` always makes its own canvas inside two
wrapping divs, so it cannot adopt the page's front canvas; the imperative
`createRoot(canvas)` can, and that is how the spike keeps the DOM contract
(the front canvas stays a plain `<canvas>` in HomePage, over the copy).
Two roots then means two stores, two renderers, two contexts — as today —
and the question of "sharing" is the same one as today: the JS `Texture`
objects are shared (one `useLoader` cache), the GPU copies are not (a
context samples only what it uploaded), so the packed masks and the shared
depth still upload twice. Fiber adds nothing and takes nothing here. What it
does add: the scene graph can belong to one root only (the back root holds
the `<primitive>`; the front root's own scene is empty and never drawn), so
the front pass is a `useFrame(…, 1)` that renders the *other* root's scene
through its own renderer, and the camera is one instance handed to both
roots (each root's resize writes the same aspect). A single canvas with two
viewports/scissor is not an option: the site needs two DOM canvases at two
stacking levels. Memory: fiber's two stores and the reconciler's fiber tree
on top of the two contexts the vanilla engine already holds.

**One loop, `frameloop="never"`.** It works as the issue sketched: fiber's
loop never starts, `invalidate()` is a no-op under "never", and one rAF loop
runs the vanilla `tickFrame` — gate, pacer, parking, wake sources, all
unchanged — and calls `advance(now, false, root)` twice. The pacer's veto
("skip this rAF, keep polling") needs the draw to be ours: a priority
`useFrame` in each root, so fiber's own `gl.render` never runs. Expressed
as `frameloop="demand"` + `invalidate()` instead, the pacer would lose its
veto (a demand frame always renders once invalidated), the 30 fps cap on the
mobile tier would need re-expressing, and the two roots would render on
fiber's global loop in root order — workable, but the gate and the pacer are
then fiber's semantics with ours bolted on, not the other way round.

**Textures, Suspense, progress.** `useLoader` gives Suspense for free and
the AVIF verdict slots in as `use(promise)`. The cost is the all-or-nothing
resolve (the +300 ms gate above) and the loss of the mask path in drei's
`useTexture` (ImageBitmapLoader with `premultiplyAlpha: "none"` is a
`useLoader` extension, fine; `useTexture` is TextureLoader only). Progress
comes off three's `DefaultLoadingManager` — a page global that drei's
`useProgress` takes over at module evaluation — instead of the scene's own
manager. `textures.ts` would go; `layers.ts` stays as a factory (its
materials are `ShaderMaterial`s built from `shaders.ts` and mounted as
`<primitive>`), unless a migration rewrites the 28 planes as JSX, which
buys nothing the tick does not already do imperatively.

**Demand rendering for the gate and the scroll ratio.** The render gate is
the loop's own start/stop, as today. The scroll ratio maps cleanly:
`root.setDpr(d)` on both roots applies `setPixelRatio` and `setSize` inside
the store subscription, synchronously, then the front vignette re-reads the
buffer size. Fiber's resize (`react-use-measure` on the wrapper) sets the
camera's aspect for the back root; the registration distance and the plane
rebuild follow in a size effect; the front root takes the back root's size.

**StrictMode.** In dev (`VITE_R3F=1 pnpm dev`) the double mount ends in the
right state — `ready`, two canvases with live contexts, progress 1 — with
three console lines the vanilla engine does not produce: `R3F.createRoot
should only be called once!` (the front root's effect runs twice on the same
canvas; fiber reuses the root it mapped to it) and `THREE.WebGLRenderer:
Context Lost.` (the first `<Canvas>` mount's renderer is disposed by the
unmount and a second context is created; the vanilla wrapper disposes its
first mount whole the same way, silently). Also `THREE.Clock: This module has
been deprecated` twice: fiber 9.7 still constructs `THREE.Clock`, which three
0.185 deprecates — a version-drift cost to expect from a second library
tracking three's release cadence.

**What a real migration rewrites.** The spike reused `tick.ts`,
`cameraSolve.ts`, `layers.ts`, `embers.ts`, `rayPlanes.ts`, `framePacer.ts`,
`renderGate.ts`, `scrollDpr.ts`, `textureWarm.ts`, `input.ts`, `sceneEnv.ts`
untouched and replaced `createParallaxScene.ts` (455 lines) and `textures.ts`
(85) with ~560 lines across six files — a rewrite of the same size that
keeps every module the factory delegated to. What fiber replaced in the end:
renderer/canvas creation and sizing (`env.createRenderer`, `resize()`), the
texture loading (`createTextureSet`), and the per-frame dispatch
(`renderPasses` → `advance` + two `useFrame`s). What it could not replace:
the tick, the pacer, the gate, the input subscriptions, the warm-up, the
front-row switching, the factories. The engine's tests (`tests/engine/*`,
the factory's env-injected tests) would need a fiber-aware harness
(`@react-three/test-renderer`, another dependency) or would stay exactly as
they are because the pure modules did not move.

## Recommendation: no-go

1. **Bytes.** The engine chunk grows from 114.9 to 198.5 kB brotli (+73 %),
   the js row from 252.3 to 336.0 kB against a 262 kB ceiling set two days
   ago at the post-Wire numbers plus 5 %. Even at fiber's floor — no
   `<Canvas>`, `createRoot()` on both canvases, three tree-shaken again — it
   is 291.7 kB, 30 kB over: the reconciler alone (~46 kB brotli with its
   deps) is more than the whole budget headroom and would need the ceiling
   raised, which #102 says is done deliberately in the PR that needs it,
   for a reason. This spike found none.
2. **The intro gate opens ~300 ms later.** Suspense's all-or-nothing resolve
   moves every texture upload behind the last landing, undoing #104's
   interleaved warm-up; the splash leaves ~280 ms later on both tiers on a
   fast connection, and the gap scales with the tier's texture count, not
   with bandwidth.
3. **Fiber does not own the loop, and cannot here.** The two-canvas split,
   the pacer's per-frame veto, the render gate and the scroll ratio all
   needed `frameloop="never"`, priority `useFrame`s that bypass fiber's
   render, and one external loop — which is the vanilla engine with fiber as
   a renderer-and-canvas factory underneath it. The parts fiber is good at
   (declarative graphs that React state drives, events and raycasting,
   composing drei components) are the parts this scene does not use: one
   camera, 28 static planes, uniforms written by a pure tick. The pixels
   match (0.05 % at the hero) precisely because nothing that draws changed.

What would change the answer: a second scene or an interactive one (hit
testing, per-object React state), the Wire budget re-cut with ~50 kB of
headroom for a framework, or fiber dropping its bundled reconciler for
React's own (it cannot; the reconciler is what fiber is).

## If go anyway — slices

Cut as its own batch after Shape, each slice with the shot gate and
`pnpm budget` (with the ceiling raised first, in a PR of its own that says
why):

1. **Budget and dependencies** — raise `js` in `budget.json`, add fiber
   (drei not needed: 0.4 kB for two hooks the engine can write itself), a
   knip entry, `tests/build` guard for the chunk name.
2. **Roots on the page's canvases** — `createRoot()` on both (not `<Canvas>`:
   the 44 kB of three it drags in), the DOM contract unchanged, the loop and
   `advance()` as in `sceneLoop.ts`; `PentecostParallax.tsx` becomes the fiber
   wrapper. Shot gate 0.5 %.
3. **Textures through `useLoader`** with an incremental warm-up: the
   per-texture `onLand` warm must be re-established outside Suspense (a
   loader `onProgress` that hands each landed texture to the warmers) or the
   +300 ms gate stays. Gate-open measured against this page's table.
4. **The graph as JSX, if wanted** — planes as `<mesh>` with `<primitive
   object={material}>`, the front row as `layers` props; `layers.ts` shrinks
   to the material factory. Optional: it moves the tick's writes into React
   props and re-renders per frame unless everything stays in refs, which is
   where the spike left it.
5. **Tests** — `tests/engine` unchanged; the factory's env-injected tests
   replaced by `@react-three/test-renderer` ones, or dropped for the shot
   gate.
6. **Retire** `createParallaxScene.ts`, `textures.ts`, `sceneEnv.ts`'s
   renderer seam; docs and `tools/README.md` updated; the `VITE_R3F` flag
   removed.

Roughly 5–6 PRs; the spike's ~560 lines are two of them already.

## Reproducing

```
# the default build is unchanged
pnpm lint && pnpm test && pnpm build && pnpm budget

# the spike
VITE_R3F=1 npx vite build --outDir <out>/dist-r3f
VITE_R3F=1 VITE_R3F_DREI=1 npx vite build --outDir <out>/dist-r3f-drei
VITE_R3F=1 VITE_R3F_CANVAS=0 npx vite build --outDir <out>/dist-r3f-nocanvas
GCC_ENGINE_ENTRY=src/engine/fiber/ParallaxFiber.tsx pnpm budget --dist <out>/dist-r3f
npx vite preview --outDir <out>/dist-r3f --port 4428 --strictPort
node tools/shots/cdp-shot.mjs --url http://localhost:4428/ --out shots/r3f/desktop --port 9288 --size 1600x900 --dpr 2 --labels Hero,Give
node tools/shots/pngdiff.mjs <baseline>/desktop/00-hero.png shots/r3f/desktop/00-hero.png
node docs/design/issue-134/measure.mjs --url http://localhost:4428/ --port 9289 --frames --size 1600x900 --dpr 2
node docs/design/issue-134/measure.mjs --url http://localhost:4428/ --port 9289 --gate --throttle 20000 --size 390x844 --mobile --dpr 3
```

The untouched tip was built in a temporary worktree at 384ca10 and served on
4429 for every "tip" row above; the shape baseline is the batch's
`shape-baseline` capture (`docs/refactor` describes the method).
