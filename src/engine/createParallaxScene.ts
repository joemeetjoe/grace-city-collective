import * as THREE from "three";

import { tierWidth, type Tier } from "@/device/tier";
import { textureUrl, tierCuts } from "@/device/textureManifest";
import { measureSections, sectionProgressAt, type SectionRect } from "@/scroll/sectionRects";
import { EMBERS_SIDE, assignLayer, canvasFor, renderPasses, type CanvasSide, type RenderPass } from "@/theme/layerSplit";
import { tokens } from "@/theme/tokens";
import { registrationDistance } from "./cameraSolve";
import { createEmbers, emberCount, type EmberLayer } from "./embers";
import { PACING, createFramePacer } from "./framePacer";
import { buildLayers, layerGeometry, planeGeometry, type Layer } from "./layers";
import { readyOnce } from "./parallaxLoading";
import { parseCuts, type Cut } from "./parallaxRelief";
import { RAY_NEAR_Z, createRayLayer, rayRenderOrder, raySpecs, type RayLayer } from "./rayPlanes";
import { createRenderGate, type RenderGate } from "./renderGate";
import { browserEnv, type Renderer, type SceneEnv } from "./sceneEnv";
import { SCROLL_DPR, createScrollDpr, movingDprFor } from "./scrollDpr";
import { createTextureSet } from "./textures";
import { createTextureWarmer } from "./textureWarm";
import { createTickState, placeLayer, tickFrame, type SceneOptions } from "./tick";
import { CAMERA, DOVE_V, FIT, GL_FLAGS, PLATE, SCENE_DEFAULTS, SCROLL_PROBE } from "./tuning";

/**
 * Doré's "The Descent of the Holy Spirit" cut into ~28 depth layers and
 * reassembled in three.js. Scroll drives a camera that visits one waypoint
 * per scene section (waypoints.ts).
 *
 * Assets in src/assets/dore/<tier>/ (dore-recut pack_textures.py), served
 * content-hashed through textureManifest.ts — the two colour textures below
 * also ship as AVIF twins (#101), requested instead of the WebP once
 * device/avif.ts has settled that the client decodes them:
 *   plate-backdrop.webp  the plate (the engraving, 2048x2519 in the desktop
 *                        tier) with every cutout inpainted back in
 *   map-<name>.webp      each cut's colour, a crop of the plate over its
 *                        mapRect (#99: nothing samples the whole plate)
 *   cuts.json            [{ name, z, isFlame, relief?, parent?, at?, map,
 *                        mapRect, depthMap?, mask }] — a flame's parent is
 *                        the head it hangs over; it rests just in front of
 *                        that cut, on its plane (see bindFlames), and leaves
 *                        it from `at` (see flamePose); mask is
 *                        { file, channel } into the packed textures
 *   masks-*.webp         four greyscale masks per texture, one per channel
 *   depth.webp           baked depth of the plate (white = near), drives the
 *                        relief of a figure without a depth crop of its own
 *
 * The masks are a partition of unity — they sum to 1 at every pixel — so the
 * layers reassemble the plate exactly, which is why the cuts leave no seams.
 *
 * Two canvases, one scene, one camera (layerSplit.ts): given a front canvas,
 * the floor, the nearest apostles on the left and the embers are drawn by a
 * second renderer to a transparent canvas that the page stacks over the
 * wordmark and the hero headline; everything else stays on the back one,
 * under the page. The camera's layer mask is switched between the two
 * passes. Textures load once (they are shared THREE.Texture objects) but a
 * context can only sample what it uploaded, so what the front figures share
 * with the back — the packed masks and the shared depth — is uploaded to both.
 *
 * The factory (#120): one call builds the scene against the canvases and
 * returns a handle. Options that change while it runs go through
 * `setOptions`; everything read once is in the config; the page and the
 * platform arrive through the env (sceneEnv.ts). The per-frame arithmetic
 * is tick.ts and cameraSolve.ts, pure and tested apart from three.js.
 */

export type SceneCanvases = {
  back: HTMLCanvasElement;
  /**
   * a second canvas, stacked above the page's type, for the nearest layers;
   * left out (undefined) everything draws to the one canvas. `null` is a
   * front canvas the page meant to hand over and had not mounted: an error
   */
  front?: HTMLCanvasElement | null;
};

export type SceneConfig = {
  /** asset tier (device/tier.ts): picks the texture directory and the counts */
  tier: Tier;
  /** how many ray planes fan out from the dove; the tier's unless pinned */
  rays?: number;
  /** how many embers drift in the foreground; 0 disables the layer. Default: emberCount() of the viewport */
  embers?: number;
  /** keeps the flames on their heads (the dolly is scroll-paced, so it stays) */
  reducedMotion?: boolean;
  /** the page's scene sections, in order, read when the scene builds */
  sections: () => readonly HTMLElement[];
  /** the page's scroll position, whichever is driving it (a smoother's, scroll/useSmoothScroll.ts); the env's own by default */
  scrollTop?: () => number;
  /** the loading manager's progress: loaded of total textures */
  onProgress?: (loaded: number, total: number) => void;
  /** every texture landed and uploaded, once */
  onReady?: () => void;
  /**
   * the scene gave up (#131), once: a refused context or a missing front
   * canvas at mount, the manifest or a texture while loading. Without a
   * listener the failure throws (or rejects) as it would have
   */
  onError?: (err: Error) => void;
  /** a debug build hands the built scene here (the page hangs it on its seam for cdp-rects.mjs) */
  debug?: (scene: SceneDebug) => void;
};

/** what a debug build exposes: the layers, the scene graph and the camera */
type SceneDebug = { layers: Layer[]; scene: THREE.Scene; camera: THREE.Camera };

export type SceneHandle = {
  /** live options; a change marks a frame and wakes a parked loop */
  setOptions(next: Partial<SceneOptions>): void;
  /** stops the loop, unsubscribes every input and frees every GPU object */
  dispose(): void;
};

export function createParallaxScene(
  canvases: SceneCanvases,
  config: SceneConfig,
  options: Partial<SceneOptions> = {},
  env: SceneEnv = browserEnv(),
): SceneHandle {
  // the error path (#131): the first failure reaches config.onError, or
  // throws where there is no listener; a mount that fails hands back an
  // inert handle, its canvases left to the page
  let failed = false;
  const fail = (err: unknown) => {
    if (failed) return;
    failed = true;
    if (!config.onError) throw err;
    config.onError(err instanceof Error ? err : new Error(String(err)));
  };
  try {
    return mountScene(canvases, config, options, env, fail);
  } catch (err) {
    fail(err);
    return { setOptions() {}, dispose() {} };
  }
}

function mountScene(
  canvases: SceneCanvases,
  config: SceneConfig,
  options: Partial<SceneOptions>,
  env: SceneEnv,
  fail: (err: unknown) => void,
): SceneHandle {
  if (canvases.front === null) throw new Error("front canvas missing");
  const opts: SceneOptions = { ...SCENE_DEFAULTS, ...options };
  const { tier } = config;
  const reducedMotion = config.reducedMotion ?? false;
  const scrollTop = config.scrollTop ?? env.scrollTop;
  const width = tierWidth(tier);
  const dpr = Math.min(env.viewport().dpr, tier.dprCap);
  // the scroll's pixel ratio (#70): reduced while the scroll flies, the
  // tier's cap again on the frame that settles
  let liveDpr = dpr;
  const renderer = env.createRenderer(canvases.back, GL_FLAGS);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(tokens.ink, 1);
  // the front canvas clears to nothing: only its layers land over the page
  const frontRenderer = canvases.front ? env.createRenderer(canvases.front, { ...GL_FLAGS, alpha: true }) : null;
  frontRenderer?.setPixelRatio(dpr);
  frontRenderer?.setClearColor(0x000000, 0);
  // without a front canvas every layer draws to the one canvas
  const sideOf = (side: CanvasSide): CanvasSide => (frontRenderer ? side : "back");
  const passes: RenderPass[] = [{ side: "back", renderer }];
  if (frontRenderer) passes.push({ side: "front", renderer: frontRenderer });
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far);
  // the drawing buffer's size, for the front layers' vignette; one vector shared by every material
  const resolution = new THREE.Vector2(1, 1);

  let disposed = false;
  // the manager's queue has drained: every texture has landed
  let loaded = false;
  // once per scene, whether or not the page listens
  const reportReady = readyOnce(config.onReady);

  // each texture warms behind the splash (#104, textureWarm.ts): a few per
  // frame through initTexture on the renderer(s) whose materials sample it
  // — a mask pack serves cuts on both canvases — so the first drawn frame
  // after the handoff uploads nothing. The ready signal waits for the
  // queue to drain; the render loop, its pacer and its gate are untouched.
  const warmTargets = new Map<THREE.Texture, Set<Renderer>>();
  const warmOn = (t: THREE.Texture, side: CanvasSide) => {
    let targets = warmTargets.get(t);
    if (!targets) warmTargets.set(t, (targets = new Set()));
    targets.add(side === "front" && frontRenderer ? frontRenderer : renderer);
  };
  const warmer = createTextureWarmer<THREE.Texture>({
    initTexture: (t) => {
      for (const r of warmTargets.get(t) ?? [renderer]) r.initTexture(t);
    },
    perFrame: tier.warmPerFrame,
  });
  let warmRaf = 0;
  const warmTick = () => {
    warmRaf = 0;
    if (disposed) return;
    warmer.tick();
    if (warmer.pending()) warmRaf = env.raf(warmTick);
    else if (loaded) reportReady();
  };
  /** a texture has landed: queue its upload */
  const warm = (t: THREE.Texture) => {
    if (disposed) return;
    warmer.add(t);
    if (!warmRaf && warmer.pending()) warmRaf = env.raf(warmTick);
  };
  const textures = createTextureSet({ maxAniso: renderer.capabilities.getMaxAnisotropy(), onLand: warm });
  textures.manager.onError = (url) => fail(new Error(`texture failed: ${url}`));

  let baseZ = 20;
  let layers: Layer[] = [];
  let backdropLayer: Layer | null = null;
  const all = () => (backdropLayer ? [backdropLayer, ...layers] : layers);
  // the stop whose front row the cuts currently wear; -1 until the first frame
  let frontStop = -1;
  let doveLayer: Layer | undefined;
  let byName = new Map<string, Layer>();
  let rayLayer: RayLayer | null = null;
  let emberLayer: EmberLayer | null = null;
  let raf = 0;
  let parked = false;
  let t0 = 0;
  let gate: RenderGate | null = null;
  let sections: readonly HTMLElement[] = [];
  // the loop runs only while the canvas is on screen and the tab is shown
  let onScreen = false;
  let visible = true;
  const syncGate = () => gate?.setVisible(onScreen && visible);
  const offs: (() => void)[] = [];
  const state = createTickState({
    // frames on demand (#68): full rate under motion, the dust tick at
    // rest, nothing at all once the dust has settled
    pacer: createFramePacer(PACING[tier.name]),
    scrollDpr: createScrollDpr({ sharp: dpr, moving: movingDprFor(dpr), ...SCROLL_DPR }),
  });

  const resize = () => {
    const vp = env.viewport();
    const w = canvases.back.clientWidth || vp.width;
    const h = canvases.back.clientHeight || vp.height;
    renderer.setSize(w, h, false);
    frontRenderer?.setSize(w, h, false);
    renderer.getDrawingBufferSize(resolution);
    camera.aspect = w / h;
    baseZ = registrationDistance(camera.aspect);
    camera.updateProjectionMatrix();
  };
  const applyPixelRatio = (d: number) => {
    liveDpr = d;
    renderer.setPixelRatio(d);
    frontRenderer?.setPixelRatio(d);
    // resize() re-applies the ratio to both drawing buffers and refreshes
    // the resolution the vignette samples
    resize();
  };

  /**
   * where we are in the scene's section stack: an index plus the fraction
   * through it (sectionRects.ts). Only the scene sections count — the
   * long-form below them scrolls past a scene that has already come to
   * rest. The rects are measured outside the tick (#64): a layout read per
   * frame stalled against ScrollSmoother's transform writes.
   */
  let sectionCache: SectionRect[] = [];
  const measure = () => {
    sectionCache = measureSections(sections, scrollTop());
  };
  const sectionProgress = () => sectionProgressAt(scrollTop() + env.viewport().height * SCROLL_PROBE, sectionCache);

  // every input path routes here: mark a frame and, if the loop is parked, re-arm it
  const wake = () => {
    state.dirty = true;
    if (parked && gate?.running) {
      parked = false;
      state.lastT = (env.now() - t0) / 1000;
      raf = env.raf(tick);
    }
  };

  const tick = () => {
    if (!gate?.running) return;
    raf = env.raf(tick);
    const now = env.now();
    const plan = tickFrame(state, {
      now,
      t: (now - t0) / 1000,
      scrollY: scrollTop(),
      progress: sectionProgress(),
      sectionCount: sections.length,
      aspect: camera.aspect,
      baseZ,
      doveZ: doveLayer?.mesh.position.z,
      reducedMotion,
      opts,
    });
    if (!plan.render) {
      // fully asleep — the dust has stopped and nothing is moving: park the
      // rAF outright (a scheduled no-op still wakes the process every frame)
      // and let the wake sources re-arm it
      if (plan.park) {
        parked = true;
        env.caf(raf);
      }
      return;
    }
    if (plan.dpr !== liveDpr) applyPixelRatio(plan.dpr);
    // the front row turns with the frame (layerSplit.ts): a cut that changes
    // side swaps canvas and takes or drops the front vignette
    if (plan.stop !== frontStop) {
      frontStop = plan.stop;
      for (const l of layers) {
        const side = sideOf(canvasFor(l, plan.stop, tier.name));
        if (side === l.side) continue;
        l.side = side;
        assignLayer(l.mesh, side);
        l.mat.uniforms.uVignette.value = side === "front" ? 1 : 0;
      }
    }
    const { position, target } = plan.pose;
    camera.position.set(position.x, position.y, position.z);
    camera.lookAt(target.x, target.y, target.z);
    rayLayer?.update({ intensity: plan.beam, glow: opts.beamGlow, zScale: plan.zScale, baseZ, cam: camera.position });
    const frame = { baseZ, zScale: plan.zScale, relief: plan.relief, flock: plan.flock, doveZ: doveLayer?.z };
    for (const l of all()) {
      const u = l.mat.uniforms;
      u.uBeam.value = plan.beam;
      u.uBeamMax.value = opts.beamGlow;
      u.uFlameDrift.value = opts.flameDrift ? 1 : 0;
      const parentAt = l.parent !== undefined ? byName.get(l.parent)?.at : undefined;
      const p = placeLayer({ z: l.z, relief: l.relief, at: l.at, flame: l.flame, parentAt }, frame);
      l.mesh.position.set(p.position.x, p.position.y, p.position.z);
      l.mesh.scale.setScalar(p.scale);
      u.uRelief.value = p.uRelief;
      u.uCamZ.value = p.uCamZ;
      u.uLayerZ.value = p.uLayerZ;
      u.uScale.value = p.uScale;
    }
    // gl_PointSize is in device pixels, which is what the canvas buffer is sized in
    emberLayer?.update({ t: plan.emberT, progress: plan.progress, sectionCount: sections.length, heightPx: canvases.back.height, refZ: baseZ });
    // one scene, one camera, two passes: the mask picks which canvas sees what
    renderPasses(scene, camera, passes);
  };

  /** the scene from its cuts, every texture resolved through `url` */
  const start = (cuts: Cut[], url: (file: string) => string, backdrop: THREE.Texture, depthMap: THREE.Texture) => {
    if (disposed) return;
    sections = config.sections();
    resize();
    measure();
    // a section whose box changes (a reveal opening, fonts arriving) moves
    // every rect below it; watching the boxes keeps the cache honest
    offs.push(env.input.onBoxChange(sections, measure));

    const built = buildLayers(cuts, {
      scene,
      textures,
      url,
      backdrop,
      depthMap,
      tier: tier.name,
      sideOf,
      baseZ,
      resolution,
      beamGlow: opts.beamGlow,
      flameDrift: opts.flameDrift,
      warmOn,
    });
    backdropLayer = built.backdrop;
    layers = built.layers;
    doveLayer = layers.find((l) => l.name === "dove");
    byName = new Map(layers.map((l) => [l.name, l]));
    config.debug?.({ layers, scene, camera });

    // the light, as planes of its own between the dove and the crowd, drawn
    // right after the crowd (see RAY_NEAR_Z) and registered like the cuts;
    // the rays fan out behind the crowd, so none crosses a front figure
    const layerZ = layers.map((l) => l.z);
    rayLayer = createRayLayer(raySpecs(config.rays ?? tier.rays), {
      geom: (z) => planeGeometry(z, baseZ),
      fit: FIT,
      plate: PLATE,
      origin: [0.5, 1 - DOVE_V],
      renderOrder: () => rayRenderOrder(layerZ, RAY_NEAR_Z),
    });
    for (const m of rayLayer.meshes) scene.add(assignLayer(m, "back"));
    // embers read the viewport once, at the tier's density; drawn after every cut, floor included
    const vp = env.viewport();
    const count = config.embers ?? emberCount({ width: vp.width, height: vp.height, dpr: vp.dpr, reducedMotion, tier: tier.name });
    const emberSide = sideOf(EMBERS_SIDE);
    emberLayer = createEmbers({ scene, camera, count, renderOrder: layers.length + 1, resolution: emberSide === "front" ? resolution : undefined });
    assignLayer(emberLayer.points, emberSide);

    t0 = env.now();
    gate = createRenderGate({
      start: () => {
        // a resumed loop must not treat the pause as one giant frame
        parked = false;
        state.lastT = (env.now() - t0) / 1000;
        raf = env.raf(tick);
      },
      stop: () => env.caf(raf),
    });
    offs.push(
      env.input.onScreen(canvases.back, (on) => {
        onScreen = on;
        syncGate();
      }),
    );
  };

  const onResize = () => {
    resize();
    measure();
    state.dirty = true;
    for (const l of all()) {
      l.mesh.geometry.dispose();
      l.mesh.geometry = layerGeometry(l, baseZ);
    }
    rayLayer?.resize();
  };
  const onPointer = (x: number, y: number) => {
    state.pointer.tx = x;
    state.pointer.ty = y;
    wake();
  };
  offs.push(
    // a hidden tab draws nothing at all (#68); rAF already throttles, the
    // gate makes it explicit and marks a frame for the return
    env.input.onVisibility((v) => {
      visible = v;
      syncGate();
      if (v) wake();
    }),
    env.input.onResize(onResize),
    env.input.onPointer(onPointer),
    env.input.onTilt(onPointer),
    // scroll intent in any form re-arms a parked loop; each is a cheap no-op while the loop runs
    env.input.onWake(wake),
    env.input.armGyro(),
  );

  // every texture request waits on the AVIF verdict (#101): the colour
  // textures resolve to their avif twins where the client decodes them,
  // and nothing may be fetched twice
  const load = (avif: boolean) => {
    if (disposed) return;
    // every texture by its file name in the tier, at its hashed url, in the client's format
    const url = (file: string) => textureUrl(width, file, { avif });
    const backdrop = textures.load(url("plate-backdrop.webp"), "colour");
    const depthMap = textures.load(url("depth.webp"), "depth");
    // cuts.json is bundled, so the cut textures start loading with the
    // backdrop and the manager's queue holds all of them before the first lands
    start(parseCuts(tierCuts(width)), url, backdrop, depthMap);
    textures.manager.onLoad = () => {
      if (disposed) return;
      state.dirty = true;
      loaded = true;
      // the last texture's own callback ran before this, so it is queued;
      // the warm tick reports once the queue has drained
      if (!warmer.pending()) reportReady();
    };
    textures.manager.onProgress = (_url, done, total) => {
      if (disposed) return;
      // a texture that lands after the scene settles still gets painted
      state.dirty = true;
      config.onProgress?.(done, total);
    };
  };
  // the manifest throwing, or the build itself, lands here too
  void env.supportsAvif().then(load).catch(fail);

  return {
    setOptions(next) {
      Object.assign(opts, next);
      wake();
    },
    dispose() {
      disposed = true;
      for (const off of offs) off();
      gate?.dispose();
      env.caf(raf);
      env.caf(warmRaf);
      for (const l of all()) {
        l.mesh.geometry.dispose();
        l.mat.dispose();
      }
      rayLayer?.dispose();
      emberLayer?.dispose();
      textures.dispose();
      renderer.dispose();
      frontRenderer?.dispose();
    },
  };
}
