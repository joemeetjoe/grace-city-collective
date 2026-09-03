# #134 — fiber or vanilla: the decision, and what would change it

**Decision: stay vanilla. Revisit when there is a second Doré plate.**

Written 2026-09-03, after the spike (`README.md` beside this file) was
forward-ported onto the finished tree and re-measured, and after the
library's current docs were read rather than recalled. It supersedes the
spike's byte figures: the spike measured a shallow port, and the real cost
of a deep one is roughly half what it reported.

Companion page, same content in a readable layout:
https://claude.ai/code/artifact/b45915ca-9d19-4ed2-8542-dcc7dcab7f26

## The correction that matters

The spike reported +84 kB brotli. Most of that was not fiber. By default
`<Canvas>` registers the whole three.js namespace so any element can appear
in JSX, which defeats tree-shaking; `createRoot` with a hand-written
catalogue does not. Building that variant recovers 44 kB.

Four builds of the same scene, measured on this tree (three 0.185,
fiber 9.7, drei 10.7). `js` is the shell chunk plus the engine chunk,
brotli, as `pnpm budget` counts it.

| build | engine raw | js brotli | vs 262 kB | desktop total (1950) | mobile total (960) |
| --- | ---: | ---: | ---: | ---: | ---: |
| vanilla, today | 552.5 kB | 255.5 | 6.5 under | 1871 | 928 |
| fiber, `<Canvas>` | 917.9 kB | 339.2 | 77.2 over | 1955 | 1012 |
| **fiber, no `<Canvas>`** | **701.9 kB** | **294.8** | **32.8 over** | **1911** | **967** |
| fiber and drei | 918.5 kB | 339.6 | 77.6 over | 1955 | 1012 |

Reproduce with:

```bash
pnpm build                                   # vanilla
VITE_R3F=1 pnpm build                        # fiber, <Canvas>
VITE_R3F=1 VITE_R3F_CANVAS=0 pnpm build      # fiber, createRoot — the floor
GCC_ENGINE_ENTRY=src/engine/fiber/ParallaxFiber.tsx pnpm budget
```

So a deep, well-optimised rewrite costs **+39 kB brotli on every first
visit**. That is the reconciler, and it cannot be optimised away because it
is the thing being bought. Published estimates put fiber's overhead near
50 kB, which agrees.

Pixels are identical either way: hero and give stop render within 0.04 % of
vanilla. Frame time is a wash — 16.7 ms median on both, no frames over
20 ms; fiber's main-thread cost per frame is fractionally higher (≈0.3 ms
against 0.2 ms) and its mobile 95th percentile roughly double (1.1–1.3 ms).
Neither is near mattering at this scene's complexity.

## What a rewrite would genuinely buy

- **About 1,300 lines of bespoke engine become library calls.** The ember
  field, ray planes, vignette, scroll-driven DPR, frame pacer and render
  gate all have counterparts: instancing, `PerformanceMonitor`,
  `AdaptiveDpr`, `frameloop="demand"` with `invalidate()`, and the
  postprocessing package. That is code we would stop maintaining.
- **A scene graph others can read.** React DevTools maps one-to-one onto
  the three.js tree.
- **Composition, once there is more than one plate.**
- **It is healthy.** 9.7 is current, React 19.2 supported, the reconciler
  vendored so it tracks React's internals.

## What it cannot fix

- **The two canvases stay, and they are not fiber's fault.** The copy sits
  between two layers of scene: the floor and the nearest apostles paint
  over the words, the rest paints under them. HTML cannot live inside one
  canvas, so that needs two canvas elements, two WebGL contexts, and shared
  textures uploaded twice. This is a cost of the visual idea, not of the
  renderer, and it is worth knowing we are paying it.
- **drei's `View` looks like the answer and is not.** Scissored viewports
  tracking DOM elements is exactly the right idea, and three.js's own
  manual prefers scissoring to multiple canvases. But scissored views share
  one canvas element and therefore one stacking position, so they cannot
  sandwich HTML. Checked; it does not apply here.
- **Fiber would not own the loop.** A pacer that vetoes frames, DPR driven
  by scroll velocity, a gate that suppresses rendering until textures land,
  and two roots advanced in a fixed order. `frameloop="never"` plus an
  external loop calling `advance()` is the documented way, and it is what
  the spike had to do.
- **Suspense fights the texture warm-up.** Loading through Suspense
  resolves all-or-nothing, undoing the few-per-frame upload behind the
  splash; that cost 300 ms of gate-open in the spike. Fixable by keeping
  the warm-up outside Suspense — which means declining one of the features
  fiber is being adopted for.

## The thresholds, and which of them are real

| threshold | where | set from | fiber floor | read |
| --- | --- | --- | ---: | --- |
| js 262 kB | `budget.json` | measured +5 % | 294.8, 33 over | a proxy we chose; the binding constraint |
| mobile total 960 kB | `budget.json` | measured +5 % | 967, 7 over | real — a phone on a real connection |
| desktop total 1950 kB | `budget.json` | measured +5 % | 1911, fits | real, not binding |
| CLS ≤ 0.01; a11y/SEO/BP = 100 | `lighthouseProfiles.cjs` | absolute | unaffected | real, keep |
| observed paint ≤ 400 ms | `paint.mjs` | ~10× observed | unaffected | real, generous |
| shot gate 0.5 % of pixels | `pngdiff.mjs` | noise floor | 0.04 % | real |

The question is not whether fiber fits the budget. It is whether we would
spend about 4 % of the mobile page's weight to delete 1,300 lines of
bespoke engine. Defensible if more plates are coming and we would rather
compose than maintain; a bad trade for one finished scene.

## Before any of this: make the engine plate-agnostic

If more Doré plates are the reason to reconsider, the renderer is not what
blocks them. Eight source files name this plate's cuts by hand:

- `theme/layerSplit.ts` — the front-canvas set, a literal `["floor",
  "fig13", "fig5", "fig1"]`, with the reasoning about fig10's robe
- `device/maskBounds.ts` — measured mask rectangles per cut
- `engine/waypoints.ts` — the camera table, including `aim: "dove"`
- `device/textureKinds.ts`, `device/tierPreload.ts` — the hero preload set
- `engine/cameraSolve.ts`, `engine/createParallaxScene.ts`

Turning those into a per-plate descriptor is required either way, and it is
identical under both architectures: the parts that would carry it —
`tick.ts`, `cameraSolve.ts`, `waypoints.ts` — are already pure functions
that take their numbers as arguments and never touch three.js.

Do that first. Then judge fiber against a real second scene, where it is
visible whether we are writing components or just writing data.

## What would flip the decision

Any one of: a second and third plate that genuinely differ; wanting the
ecosystem rather than hand-writing the next effect; anyone other than the
author maintaining the scene. Then the same 39 kB starts looking cheap.

## Sources, read 2026-09-02/03

- R3F changelog — 9.5–9.7, React 19.2, vendored reconciler
- R3F docs, *Scaling performance* — `frameloop` demand, `invalidate`,
  `PerformanceMonitor`, `regress`
- R3F docs, *Objects* and the three.js forum thread on Vite tree-shaking —
  why `<Canvas>` costs 44 kB
- drei docs, *View*, and the three.js manual on multiple scenes — scissoring
- R3F discussion #2716 — WebGL contexts do not share textures
- Thoughtworks Technology Radar, and a 2026 three.js/R3F/Babylon comparison
