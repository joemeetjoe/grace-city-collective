import { advance } from "@react-three/fiber";

import { measureSections, sectionProgressAt, type SectionRect } from "@/scroll/sectionRects";
import { readyOnce } from "../parallaxLoading";
import { createRenderGate, type RenderGate } from "../renderGate";
import { browserEnv, type SceneEnv } from "../sceneEnv";
import { tickFrame } from "../tick";
import { SCROLL_PROBE } from "../tuning";
import type { Shared } from "./shared";

/**
 * The one loop over two `frameloop="never"` roots (#134 spike): the vanilla
 * tick with its render gate, pacer and parking kept whole, and the draw
 * handed to fiber — `advance(now, false, root)` runs each root's useFrame
 * subscribers (the back root applies the plan and draws its pass, the front
 * root draws its own) in place of renderPasses(). Every input still routes
 * through `wake`; the scroll ratio goes through each root's `setDpr`.
 * Fiber's own loop never runs: `invalidate()` is a no-op under "never".
 */

export type LoopConfig = {
  sections: () => readonly HTMLElement[];
  scrollTop?: () => number;
  onProgressWarm?: () => void;
  onReady?: () => void;
  /** the mount's pixel ratio, what both roots were created at */
  dpr: number;
};

export type SceneLoop = {
  wake(): void;
  /** a root came up, or the graph was built: arms the gate once all three are there */
  arm(): void;
  /** textures were queued on the warmers: upload them a few per frame, then report ready */
  warm(): void;
  dispose(): void;
};

export function createSceneLoop(shared: Shared, config: LoopConfig, env: SceneEnv = browserEnv()): SceneLoop {
  const scrollTop = config.scrollTop ?? env.scrollTop;
  const reportReady = readyOnce(config.onReady);
  const offs: (() => void)[] = [];
  let disposed = false;
  let armed = false;
  let raf = 0;
  let warmRaf = 0;
  let parked = false;
  let t0 = 0;
  let liveDpr = config.dpr;
  let gate: RenderGate | null = null;
  let onScreen = false;
  let visible = true;
  const syncGate = () => gate?.setVisible(onScreen && visible);

  let sectionCache: SectionRect[] = [];
  const measure = () => {
    sectionCache = measureSections(shared.sections, scrollTop());
  };
  const sectionProgress = () => sectionProgressAt(scrollTop() + env.viewport().height * SCROLL_PROBE, sectionCache);

  const wake = () => {
    shared.state.dirty = true;
    if (parked && gate?.running) {
      parked = false;
      shared.state.lastT = (env.now() - t0) / 1000;
      raf = env.raf(tick);
    }
  };

  const tick = () => {
    if (!gate?.running) return;
    raf = env.raf(tick);
    const now = env.now();
    const { camera, objects } = shared;
    const plan = tickFrame(shared.state, {
      now,
      t: (now - t0) / 1000,
      scrollY: scrollTop(),
      progress: sectionProgress(),
      sectionCount: shared.sections.length,
      aspect: camera.aspect,
      baseZ: shared.baseZ,
      doveZ: objects?.dove?.mesh.position.z,
      reducedMotion: shared.reducedMotion,
      opts: shared.opts,
    });
    if (!plan.render) {
      if (plan.park) {
        parked = true;
        env.caf(raf);
      }
      return;
    }
    const { back, front } = shared.roots;
    if (!back || !front) return;
    if (plan.dpr !== liveDpr) {
      // fiber applies the ratio and the buffer size to each renderer inside setDpr
      liveDpr = plan.dpr;
      back.setDpr(plan.dpr);
      front.setDpr(plan.dpr);
      back.gl.getDrawingBufferSize(shared.resolution);
    }
    shared.plan = plan;
    // one scene, one camera, two roots: each root's useFrame draws its pass
    advance(now, false, back);
    advance(now, false, front);
  };

  const warmTick = () => {
    warmRaf = 0;
    if (disposed) return;
    const { back, front } = shared.warmers;
    back.tick();
    front.tick();
    if (back.pending() || front.pending()) warmRaf = env.raf(warmTick);
    else if (shared.loaded) reportReady();
  };

  const onPointer = (x: number, y: number) => {
    shared.state.pointer.tx = x;
    shared.state.pointer.ty = y;
    wake();
  };
  offs.push(
    env.input.onVisibility((v) => {
      visible = v;
      syncGate();
      if (v) wake();
    }),
    // fiber resizes the renderers and the camera from its own observer; the
    // section rects and the geometry (SceneGraph's size effect) are ours
    env.input.onResize(() => {
      // without <Canvas> nothing measures the back root: it follows the window (SceneGraph's size effect does the rest)
      if (!__R3F_CANVAS__) {
        const back = shared.roots.back;
        const el = back?.gl.domElement.parentElement;
        if (back && el) back.setSize(el.clientWidth, el.clientHeight);
      }
      measure();
      shared.state.dirty = true;
    }),
    env.input.onPointer(onPointer),
    env.input.onTilt(onPointer),
    env.input.onWake(wake),
    env.input.armGyro(),
  );

  return {
    wake,
    arm() {
      const { back, front } = shared.roots;
      if (disposed || armed || !back || !front || !shared.objects) return;
      armed = true;
      shared.sections = config.sections();
      measure();
      offs.push(env.input.onBoxChange(shared.sections, measure));
      t0 = env.now();
      gate = createRenderGate({
        start: () => {
          parked = false;
          shared.state.lastT = (env.now() - t0) / 1000;
          raf = env.raf(tick);
        },
        stop: () => env.caf(raf),
      });
      offs.push(
        env.input.onScreen(back.gl.domElement, (on) => {
          onScreen = on;
          syncGate();
        }),
      );
    },
    warm() {
      if (disposed) return;
      const { back, front } = shared.warmers;
      if (!warmRaf && (back.pending() || front.pending())) warmRaf = env.raf(warmTick);
      else if (!warmRaf && shared.loaded) reportReady();
    },
    dispose() {
      disposed = true;
      for (const off of offs) off();
      gate?.dispose();
      env.caf(raf);
      env.caf(warmRaf);
    },
  };
}
