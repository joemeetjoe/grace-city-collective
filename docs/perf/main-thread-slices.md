# Main-thread slices (Vitals 12/13, #114)

The long tasks on the mobile trace, each with a number, and the sub-issues
they earn, drafted here for filing. Nothing below is filed; #114 closes
when every draft is an issue and linked from it.

Measured on branch `wf-114` on top of `d5b12c0` (Vitals batch through #104,
the texture warm-up), 2026-09-02, Lighthouse 12.6.1 via @lhci/cli 0.15.1,
HeadlessChrome 152 on a Mac (benchmark index 3398). The build is the
production build with source maps (`pnpm exec tsc -b && pnpm exec vite
build --sourcemap`; the maps add a `sourceMappingURL` comment to each
chunk and nothing else), so the trace's frames resolve to source.

## The numbers

`pnpm lighthouse --profile mobile` — three runs, the median run's `long-tasks`
(the gate: `.lighthouseci/mobile/localhost-index_html-2026_09_02_02_52_07`):

| profile | perf | LCP     | TBT   | Speed Index | TTI     | FCP     |
| ------- | ---: | ------: | ----: | ----------: | ------: | ------: |
| mobile  |   84 | 4012 ms | 62 ms |     3672 ms | 4047 ms | 2105 ms |

| start   | duration | script (audit)    | what it is (trace)                                                  |
| ------: | -------: | ----------------- | ------------------------------------------------------------------- |
| 3162 ms |   109 ms | assets/index-*.js | the scene's first draw, in the same frame as a texture warm tick    |
| 3084 ms |    53 ms | assets/index-*.js | the React commit that mounts the engine, and the scene build after  |

The other two runs: 117 ms and 53 ms, plus a 55 ms task at 3267 ms (the
intro handoff, below); 132 ms and 57 ms. Everything is inside 3.0–3.3 s,
the window in which the engine chunk and the textures have arrived over
the simulated network and the splash is still on screen. `bootup-time`:
shell chunk 1479 ms (509 ms scripting), engine chunk 731 ms (422 ms
scripting), `index.html` 205 ms. `mainthread-work-breakdown`: 2.58 s —
script evaluation 957 ms, other 895 ms, style and layout 430 ms,
rendering 268 ms. `dom-size`: 799 elements.

Against the #112 baseline (172 ms TBT, four long tasks of 188/75/55/54 ms
at 3.0–3.6 s): the warm-up (#104) took the 188 ms task down to 109 and
removed one of the two 55 ms tasks; TBT 172 → 62 ms.

The audit's `script` column names the shell chunk for both tasks because
the callbacks run under a shell-chunk frame (React's scheduler, the
requestAnimationFrame loop registered from the engine effect). The time
is the engine chunk's and three.js's — see the attribution.

### What the durations mean

Lighthouse's mobile profile is simulated throttling: Chrome runs the page
unthrottled and lantern rescales each task by `cpuSlowdownMultiplier`
(4) — **halved to ×2 for any task that ran a `Layout`**
(`DEFAULT_LAYOUT_TASK_MULTIPLIER = 0.5` in lantern's simulator). Every
task above contains a Layout event, so the reported number is twice the
observed one: the 109 ms task is 55 ms on this Mac. The attribution below
gives observed ms with the reported figure in parentheses; the acceptance
number of each draft is the reported one, since that is what the gate
reads.

## Attribution

Lighthouse CI keeps no trace, so six more mobile runs were taken with
Lighthouse's own CLI and `--save-assets` (`vite preview` on 4409; the same
default mobile profile), three of them with the V8 sampling profiler in
the trace (`--additional-trace-categories=disabled-by-default-v8.cpu_profiler`),
and read with `node tools/perf/longTasks.mjs <report.json>`: the audit's
own task selection and lantern timings, each task's trace events, and its
profiler samples by source, by nearest `src/` frame and by leaf frame,
resolved through the source maps. The profiler adds one task of its own
(`CpuProfiler::StartProfiling`, 52–78 ms at 0.6 s, "Unattributable"),
which is not the page's and is left out.

The same tasks recur in every run. Reported ms per run, the median
across the nine (three CI, three plain, three profiled):

| task                            | CI 1 | CI 2 | CI 3 | plain     | profiled  | median | ≥ 50 ms in |
| ------------------------------- | ---: | ---: | ---: | --------- | --------- | -----: | ---------- |
| A. React mount of the shell     |    – |    – |    – | 47/45/47  | 49/50/48  |   47.5 | 1 of 9     |
| B. engine commit + scene build  |   53 |   57 |   53 | 53/54/68  | 55/55/55  |     55 | 9 of 9     |
| C. first draw + warm tick       |  117 |  132 |  109 | 116/95/85 | 86/99/111 |    109 | 9 of 9     |
| D. intro handoff (nav reveal)   |   55 |    – |    – | 51/55/32  | 34/35/35  |     35 | 3 of 9     |
| W. a texture warm tick          |    – |    – |    – | –/44/32   | 48,38/44/– |    44 | 0 of 9     |

("–": under 50 ms in a CI run, which lists only the tasks over; not
present over 30 ms in a plain run.)

### C. The first draw — 109 ms (55 observed), every run

Observed 42.6–58.0 ms at ~420 ms into the unthrottled load. One
animation frame whose two rAF callbacks land in the same task:

- `warmTick` (`src/engine/PentecostParallax.tsx:400`, #104's warmer) —
  `initTexture` for three textures: three.js `texSubImage2D` uploads and
  `Decode Image` for the colour textures, 6–17 ms.
- `tick` (`PentecostParallax.tsx:685`, the render loop) → `renderPasses`
  (`src/theme/layerSplit.ts:100`) → `WebGLRenderer.render`, 25–40 ms, of
  which:
  - **shader link** — `gl.linkProgram` / `onFirstUse` in three's
    WebGLProgram (`three.module.js:7094`): **13.8 / 15.5 / 15.4 ms** in the
    three profiled runs (28–31 reported). Every material's program is
    compiled and linked at first use, inside the first draw.
  - **texture upload** — `texSubImage2D` (`three.module.js:10646`) under
    the draw: **14.7 / 20.6 / 28.6 ms** (29–57 reported). The loop's first
    tick runs before the warmer has drained (it starts when the canvas is
    visible, `src/engine/renderGate.ts`; the warmer does 3 per frame on
    mobile), so the draw uploads whatever the warm ticks have not reached.
  - `Decode Image` events, 11.9 / 17.3 / 24.8 ms observed in the task
    (24–50 reported): the plate and cut colour textures come through
    `THREE.TextureLoader` (an `<img>`), decoded on the main thread at
    upload. The masks and depth come through `ImageBitmapLoader` and are
    decoded off it already.
  - the draw calls themselves, `Uc.render`, uniforms, matrices: ~3 ms.

Three drafts (1–3) carve this task; together they leave the first draw at
the draw calls, ~10–15 ms reported.

### B. The engine commit and the scene build — 53 ms (27 observed), every run

Observed 26.5–34.1 ms at ~365 ms. One task, two halves:

- React's `performWorkUntilDeadline` (11–12 ms): the commit that mounts
  `PentecostParallax`; its effect (`PentecostParallax.tsx:341`) constructs
  the renderer(s) — `getContext` 3.2 ms, `getExtension` 2.4 ms,
  `setSize` 3.7–4.3 ms, `initGLContext` — 11.0–11.5 ms.
- `RunMicrotasks` (13.5–14.2 ms): `supportsAvif().then(load)` resolves
  and `load` (`:954`) calls `start` (`:565`) at once — the scene from the
  bundled cuts: `geom` (`:491`, a `PlaneGeometry` per cut over its mask
  box) 6.5–7.5 ms, `resize` (`:478`) 2.0–2.4 ms, `maskTexture` (`:435`)
  ~1 ms, `maskBounds` 0.5–0.8 ms, the embers 0.3 ms.

Draft 4 splits it.

### D. The intro handoff — 35 ms median, 51–55 ms in 3 of 9 (not filed)

Observed 15.8–27.7 ms at ~2450 ms, when the splash's mark lands:
`useIntroGate`'s layout effect (`src/features/intro/useIntroGate.ts:44`)
builds the nav reveal and the hero rise. Profiled: gsap's CSSPlugin
12.9–13.7 ms under `buildNavReveal`'s `arrive` (`navReveal.ts:54`, the
`tl.fromTo` over the links, calls to action, dots and glass — computed
style reads per element, `CSSPlugin.js:198`), plus `UpdateLayoutTree`
5.2–7.3 ms and `Layout` 2.7–3.7 ms forced by those reads;
`SplitText.create` / `onSplit` (`heroRise.ts:36`) 0.8–1.0 ms; the React
commit that drops the splash ~1 ms.

Under 50 ms on the median, so not filed. If it is promoted (it is the
first task to cross when the handoff moves, #107/#113), the slice is: the
reveal's "from" state written by CSS (`[data-nav-reveal]` starts at
`opacity: 0` and its offset) so the timeline is `to()` only and reads
nothing — test: `buildNavReveal` creates no `fromTo` tween and the
targets' computed opacity before the timeline plays is 0; expected
−12 ms observed (−24 reported), the forced layout with it.

### Not filed (30–50 ms)

- **A. React mount of the shell** — 45–50 ms (22.7–25.0 observed) at
  ~50 ms into the load: `performWorkUntilDeadline` 17 ms, of which
  react-dom 8.3 ms; `Lockup`'s `measure` (`src/marks/Lockup.tsx:38`,
  `getComputedStyle` in a layout effect, the page's first style
  resolution) 4.7 ms; `detectWebgl` (`src/device/fallback.ts:24`, a
  scratch WebGL context) 1.9 ms; `SmoothHeight` (`src/ui/SmoothHeight.tsx:24`)
  1.9 ms; gsap 1.8 ms; then `UpdateLayoutTree` 4.6 ms and `Layout` 1.8 ms.
  Over 50 once in nine runs.
- **W. Texture warm ticks** — 32–48 ms (15–24 observed) at 400–510 ms:
  three `initTexture` per tick, `texSubImage2D` 15 ms and `Decode Image`
  13 ms. Draft 2 takes the decode out of them; with it a tick is ~12 ms
  reported.
- **Candidates from the issue with no task of their own**: SplitText
  (0.8–1.0 ms inside D); the smoother's setup (no task over 30 ms; its
  per-frame read `src/scroll/position.ts:26` is 0.3–0.8 ms in every task
  above); anisotropy (set in `sharpen`, `PentecostParallax.tsx:420`,
  and paid inside the upload — not a separable event in the trace; it
  rides with Draft 3).

## Drafts

Each is an issue as written: title, body, the number it carries. Drafts
1–4 all edit the engine effect in `src/engine/PentecostParallax.tsx` and
touch #104's warmer; land 4 first (it moves the scene build into the
place 1 and 3 hook), then 3 and 1 (one "ready" gate), then 2 (independent
of the loop). Each re-measures with `pnpm lighthouse --profile mobile`
(three runs, median) and, for the attribution check, the profiled
Lighthouse run and `tools/perf/longTasks.mjs` (`tools/README.md`).

### Draft 1 — `Vitals 12/13 slice: link the scene's shader programs before the first draw`

**What to build.** Compile and link every material's program behind the
splash instead of in the first draw: `renderer.compileAsync(scene,
camera)` (KHR_parallel_shader_compile where the GPU has it; a resolved
promise otherwise) once `start()` has built the layers, on both
renderers where there is a front canvas, and the render loop's first
tick waits on it alongside the warmer (Draft 3) — one `sceneReady`
promise in `PentecostParallax.tsx` that the gate's `start` awaits. A
material added after (a cut whose texture lands late) compiles on its own
first use, as now.

**Acceptance criteria.**
- Behaviour test (`src/engine/PentecostParallax.test.tsx` with the fake
  renderer): the loop's first `render` happens only after `compileAsync`
  has resolved; `compileAsync` is called once per renderer with the scene
  and camera; a renderer without `compileAsync` still starts.
- Trace: in the first-draw task, `linkProgram`/`onFirstUse`
  (`three.module.js` WebGLProgram) ≤ 2 ms observed
  (`node tools/perf/longTasks.mjs`, "by leaf frame").
- The mobile median's first-draw task is under 81 ms reported before
  Draft 3 lands, or the combined target in Draft 3 after.

**Measured.** 13.8 / 15.5 / 15.4 ms observed in the three profiled runs
(28–31 ms reported) of the 109 ms task. Expected delta: −28 ms reported
on that task; the link itself moves off the main thread (parallel
compile) or, without the extension, into its own task behind the splash.

**Blocked by.** Draft 4 (the scene build in its own frame is where the
compile is issued). Touches the same `start()`/loop code as Draft 3.

### Draft 2 — `Vitals 12/13 slice: decode the colour textures off the main thread`

**What to build.** Load the plate backdrop and the cut colour maps
(`loader.load(url(...))` in `load()` and the cut maps in `start()`,
`PentecostParallax.tsx:958` and `:591`) through the `ImageBitmapLoader`
the masks already use (`:432`; `imageOrientation: "flipY"`, premultiply
default for colour), so the decode happens off-thread at fetch and the
upload is a copy. Keep `sharpen()` and the sRGB colour space on the
resulting textures; `flipY` false as for the masks. The AVIF twins (#101)
come through the same `url()` and need nothing more.

**Acceptance criteria.**
- Behaviour test: every colour texture the scene builds carries an
  `ImageBitmap` image (or the loader mock records `ImageBitmapLoader` for
  the plate and every cut map); `colorSpace` stays `SRGBColorSpace` and
  `flipY` is false; the shot gate (`tools/README.md`) shows no pixel
  change on either tier — orientation and premultiplication are what
  `flipY`/`premultiplyAlpha` decide.
- Trace: no `Decode Image` event inside the first-draw task or any warm
  tick (`tools/perf/longTasks.mjs`, "trace events").
- The mobile median's first-draw task loses its `Decode Image` time
  (24–50 ms reported) and no warm tick exceeds 25 ms reported.

**Measured.** `Decode Image` 11.9 / 17.3 / 24.8 ms observed in the
first-draw task (24–50 ms reported) and 12.9 ms of an 18.8 ms warm tick.
Expected delta: −24 to −50 ms reported on the 109 ms task; warm ticks
from 32–48 to ~12 ms reported.

**Blocked by.** Nothing. Independent of Drafts 1/3/4 but edits the same
`load()`/`start()` texture code; land after Draft 4 to avoid a rebase.

### Draft 3 — `Vitals 12/13 slice: first draw only after the warm-up has drained`

**What to build.** The render loop starts when the scene is ready, not
when the canvas is visible: the gate's `start` (`src/engine/renderGate.ts`)
waits on the same `sceneReady` as Draft 1 — `manager.onLoad` has fired
and `warmer.pending() === 0` (the `reportReady` condition that already
exists at `PentecostParallax.tsx:405` and `:972`) — so every texture reaches
the GPU in a warm tick (3 per frame on mobile, 6 on desktop, #104) and
the first draw uploads none. The splash is on screen throughout (the
warm-up finishes ~250 ms after the last texture lands, unthrottled; the
splash runs 2.4 s), so nothing visible moves; a texture that lands after
the loop is running is warmed by its own tick before its first draw, as
now. `dirty` still marks a frame when `onProgress` fires.

**Acceptance criteria.**
- Behaviour test: with a fake renderer and the pure warmer, the loop's
  first `render` is requested only after `pending()` returns 0 and
  `onLoad` has run — visible earlier, it stays parked; a texture added
  after the first draw is `initTexture`d in a tick before the next draw.
- Trace: no `texSubImage2D` (`three.module.js` WebGLTextures) under
  `renderPasses` in the first-draw task.
- The mobile median's first-draw task under 25 ms reported with Drafts 1
  and 2 landed (the draw calls, ~3 ms observed, plus paint).

**Measured.** `texSubImage2D` under the draw 14.7 / 20.6 / 28.6 ms observed
(29–57 ms reported) of the 109 ms task. Expected delta: −29 to −57 ms
reported on that task; the uploads move into warm ticks that are already
under 50 ms (≤ 48 reported; ≤ 25 with Draft 2). Anisotropy
(`sharpen`, `:420`) is paid inside these uploads and moves with them.

**Blocked by.** Draft 4. Shares the `sceneReady` gate with Draft 1.

### Draft 4 — `Vitals 12/13 slice: build the scene in its own frame, after the engine's commit`

**What to build.** The commit that mounts `PentecostParallax` does the
renderer construction only; the scene build runs in a frame of its own.
`load()` (`PentecostParallax.tsx:954`), reached from
`supportsAvif().then(load)`, calls `start()` synchronously in that
microtask, which lands it in the same task as React's commit. Schedule
`start()` with `requestAnimationFrame` (or `requestIdleCallback` with a
rAF fallback) from `load`, keeping the texture requests where they are so
the fetches still begin in the commit's microtask and nothing arrives
later. The cut geometries (`geom`, 6.5–7.5 ms for the tier's cuts) can
also be built per cut as its mask box is known rather than all in
`start()`, but that is a follow-on: the split alone gets both halves
under 50 ms.

**Acceptance criteria.**
- Behaviour test (`PentecostParallax.test.tsx` with fake rAF): after the
  effect has run and the AVIF verdict resolved, the texture requests have
  been issued and `scene.children` is empty until the next animation
  frame, when the layers exist; disposal before that frame cancels the
  build.
- Trace: the engine commit's task (React `performWorkUntilDeadline` with
  the effect at `:341`) has no `start`/`geom` frames; `start()` is in its
  own `FireAnimationFrame` task under 30 ms reported.
- The mobile median shows no task over 50 ms at the engine's mount (the
  53 ms task at ~3084 ms becomes two under 30).

**Measured.** 53 ms reported (26.5–34.1 ms observed; 27 on the median):
renderer construction 11.0–11.5 ms observed, `start()` 13.5–14.2 ms
observed in `RunMicrotasks`. Expected delta: −29 ms reported on that task
(the commit alone, ~22–24 ms reported), the build ~28 ms reported in its
own frame.

**Blocked by.** Nothing; first of the four. Drafts 1 and 3 hook the frame
this creates.

## Re-running

```bash
pnpm exec tsc -b && pnpm exec vite build --sourcemap
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm lighthouse --profile mobile
# attribution: a Lighthouse CLI run with its trace, then the report
pnpm preview --port 4409 --strictPort &
node node_modules/.pnpm/lighthouse@*/node_modules/lighthouse/cli/index.js \
  http://localhost:4409/index.html --save-assets --output=json --output-path=out/lh.json \
  --chrome-flags="--headless=new" --additional-trace-categories=disabled-by-default-v8.cpu_profiler
node tools/perf/longTasks.mjs out/lh.json --min 30
```

`--min 30` shows the 30–50 ms tasks too. Without the profiler category the
report stops at the trace events (the callback entry points and the
`Decode Image`/`Layout` events), which is enough to check Drafts 2–4;
Draft 1's link time needs the profiler.
