import { budgetYaw, chase, orbitPose, reliefGain, type Pose } from "./cameraOrbit";
import { solveCamera, type Frame } from "./cameraSolve";
import { ascentProgress, flamePose } from "./flamePose";
import { scrollMoved, type FrameDecision } from "./framePacer";
import { huddleShift, reliefUniforms } from "./parallaxRelief";
import { rayIntensity } from "./rayPlanes";
import { stopAt } from "@/theme/layerSplit";
import {
  CHASE,
  CHASE_DT_MAX,
  DOVE_FALLBACK_Z,
  DOVE_V,
  EMBER_DT_MAX,
  IDLE_DRIFT,
  LATERAL_MAX,
  PLATE,
  POINTER_EPS,
  POINTER_SLIDE,
  SETTLE_EPS,
  SPREAD,
} from "./tuning";
import { WAYPOINTS, smoothstep01 } from "./waypoints";

/**
 * The per-frame step as a pure function over an explicit state (#120): the
 * pacing decision, the section progress, the chases, the camera solve and
 * the pointer's orbit, and where every layer goes. It reads numbers and
 * returns numbers; the factory (createParallaxScene.ts) reads the page and
 * writes the results to three.js.
 */

/** the live options: every one may change between frames without rebuilding the scene */
export type SceneOptions = {
  /** how far apart the cut planes sit; 1 = as authored */
  layerSpread: number;
  /** depth of the per-figure relief in world units; 0 = flat cards */
  figureRelief: number;
  /** intensity of the light rays and the dove's halo */
  beamGlow: number;
  /** the tongues' fire glow (held steady since #63) */
  flameDrift: boolean;
  /** slow autonomous drift when the page is idle; never under reduced motion */
  idleDrift: boolean;
  /**
   * the visitor prefers reduced motion, live (#132): the idle drift stops.
   * What the scene was built with stays built — the embers' count and the
   * flames' ascent read the mount's value (SceneConfig.reducedMotion)
   */
  reducedMotion: boolean;
  /** half-swing of the pointer's orbit about the look-at point, degrees */
  orbitYaw: number;
  /** vertical half-swing of the same orbit, degrees */
  orbitPitch: number;
  /** figureRelief ramps to this with the pointer at either edge */
  reliefMax: number;
};

export type TickState = {
  /** the camera chases its target through this, so scroll jumps arrive as a glide instead of a lurch */
  cam: Frame & { init: boolean };
  /** the flames' ascent progress, chased the same way (flamePose.ts) */
  flock: { p: number };
  /** the pointer (or the gyro) writes the target; the chase moves the value */
  pointer: { x: number; y: number; tx: number; ty: number };
  /** every chase converged, as of the last drawn frame */
  settled: boolean;
  /** the scroll of the last drawn frame; NaN before the first */
  drawnScroll: number;
  /** the embers' own clock: drawn time × the pacer's rate, so the drift eases to a stop instead of freezing mid-air */
  emberT: number;
  /** scene seconds at the last tick */
  lastT: number;
  /**
   * motion the tick cannot read arrives as a dirty mark (#68): a resize, an
   * option change, a late texture, the tab coming back — each buys one
   * frame, and the chases keep the loop hot until they converge again
   */
  dirty: boolean;
  pacer: { frame(now: number, moving: boolean): FrameDecision };
  scrollDpr: { forSpeed(pxPerS: number): number };
};

export function createTickState(init: Pick<TickState, "pacer" | "scrollDpr">): TickState {
  return {
    cam: { x: 0, y: 0, z: 0, init: false },
    flock: { p: 0 },
    pointer: { x: 0, y: 0, tx: 0, ty: 0 },
    settled: false,
    drawnScroll: Number.NaN,
    emberT: 0,
    lastT: 0,
    dirty: true,
    ...init,
  };
}

export type TickInput = {
  /** the pacer's clock, ms */
  now: number;
  /** scene seconds since the loop started: the idle drift's clock */
  t: number;
  /** the smoothed scroll, px */
  scrollY: number;
  /** section progress, unclamped (sectionRects.ts) */
  progress: number;
  sectionCount: number;
  aspect: number;
  /** the registration distance for this aspect (cameraSolve.ts) */
  baseZ: number;
  /** the dove plane's live z, when the set has a dove */
  doveZ?: number;
  reducedMotion: boolean;
  opts: SceneOptions;
};

/** a frame to draw, and everything the factory writes to the scene for it */
export type FramePlan = {
  render: true;
  /** the ratio to draw at: reduced while the scroll flies (scrollDpr.ts) */
  dpr: number;
  /** section progress clamped to the last section: the camera's */
  sp: number;
  /** and unclamped: the embers' */
  progress: number;
  /** the stop whose front row the cuts wear (layerSplit.ts) */
  stop: number;
  /** a plane sits at rest z × zScale: the spread pushed further by the dolly */
  zScale: number;
  /** the light's intensity across the scene */
  beam: number;
  /** the relief gain, leaning toward the pointer */
  relief: number;
  /** the camera, orbited about the point it looks at */
  pose: Pose;
  /** the flames' chased ascent */
  flock: number;
  emberT: number;
};

export type TickResult = { render: false; park: boolean } | FramePlan;

/**
 * One animation frame. `render: false` skips the draw; `park` with it says
 * nothing at all is moving and the dust has stopped, so the rAF may be
 * cancelled outright until a wake source re-arms it.
 */
export function tickFrame(state: TickState, input: TickInput): TickResult {
  const { opts: o, now, t, scrollY } = input;
  const { pointer, cam, flock } = state;
  // is anything but the dust moving? — cheap reads only, no layout
  const pointerLive = Math.abs(pointer.tx - pointer.x) > POINTER_EPS || Math.abs(pointer.ty - pointer.y) > POINTER_EPS;
  const idle = o.idleDrift && !o.reducedMotion ? 1 : 0;
  const moving = state.dirty || !state.settled || pointerLive || scrollMoved(scrollY, state.drawnScroll) || idle > 0;
  const frame = state.pacer.frame(now, moving);
  if (!frame.render) return { render: false, park: !moving && frame.emberRate === 0 };
  state.dirty = false;
  const dtRaw = t - state.lastT;
  state.lastT = t;
  // px/s of the smoothed scroll, frame to drawn frame: a flying scroll
  // renders lighter, the settling frame lands back at the sharp cap
  const speed = Number.isFinite(state.drawnScroll) && dtRaw > 0 ? Math.abs(scrollY - state.drawnScroll) / dtRaw : 0;
  state.drawnScroll = scrollY;
  const dpr = state.scrollDpr.forSpeed(speed);
  // clamped, so a sleep or a paused loop never lands as a leap of drift
  state.emberT += Math.min(EMBER_DT_MAX, dtRaw) * frame.emberRate;
  const spread = Math.min(SPREAD.max, Math.max(SPREAD.min, o.layerSpread));

  const sp = Math.min(input.sectionCount - 1, input.progress);
  // the dolly and the rising flames play out across the scene, not the
  // whole page — the long-form below it must not stretch them thin
  const ease = smoothstep01(input.sectionCount > 1 ? sp / (input.sectionCount - 1) : 0);
  const ascent = ascentProgress(sp, input.reducedMotion);

  const drift = {
    x: Math.sin(t * IDLE_DRIFT.x.rate) * IDLE_DRIFT.x.amp * idle,
    y: Math.cos(t * IDLE_DRIFT.y.rate) * IDLE_DRIFT.y.amp * idle,
  };
  // critically-damped chase: framerate-independent, no overshoot — the
  // pointer and the camera share one rate so neither lags the other
  const dt = Math.min(CHASE_DT_MAX, dtRaw);
  const k = chase(CHASE, dt);
  pointer.x += (pointer.tx - pointer.x) * k;
  pointer.y += (pointer.ty - pointer.y) * k;

  const { target, limit } = solveCamera({ sp, aspect: input.aspect, baseZ: input.baseZ, doveZ: input.doveZ, drift });
  if (!cam.init) {
    cam.x = target.x;
    cam.y = target.y;
    cam.z = target.z;
    cam.init = true;
    flock.p = ascent;
  }
  cam.x += (target.x - cam.x) * k;
  cam.y += (target.y - cam.y) * k;
  cam.z += (target.z - cam.z) * k;
  // the flock rides the same damping, so a snap sends it gliding with the
  // camera instead of jumping ahead of it
  flock.p += (ascent - flock.p) * k;
  // converged within a subpixel: with the scroll and pointer also still,
  // the next frames are the pacer's to skip
  state.settled =
    Math.abs(target.x - cam.x) < SETTLE_EPS.camera &&
    Math.abs(target.y - cam.y) < SETTLE_EPS.camera &&
    Math.abs(target.z - cam.z) < SETTLE_EPS.camera &&
    Math.abs(ascent - flock.p) < SETTLE_EPS.flock;
  // the pointer (and the gyro, which writes the same target) orbits the
  // camera about the plate-plane point it looks at, so the near figures
  // swing across the arch while the plate holds still; the slide it adds on
  // top is what the lateral budget confines, and the orbit's own reach is
  // capped against the same budget so the wall stays hidden
  const yaw = Math.min(o.orbitYaw, budgetYaw(cam.z, PLATE.w * LATERAL_MAX));
  const pose = orbitPose(cam, pointer, { yawDeg: yaw, pitchDeg: o.orbitPitch, slide: POINTER_SLIDE, limit });
  return {
    render: true,
    dpr,
    sp,
    progress: input.progress,
    stop: stopAt(sp),
    zScale: spread + ease * SPREAD.dolly,
    beam: rayIntensity(sp / (WAYPOINTS.length - 1)),
    relief: reliefGain(pointer.x, o.figureRelief, o.reliefMax),
    pose,
    flock: flock.p,
    emberT: state.emberT,
  };
}

/** what a layer's placement needs to know about it: its authored depth and relief, its centre, and — a flame — its ordinal and its parent's centre */
export type LayerRest = {
  z: number;
  relief: number;
  /** the cut's centre as plate fractions (figures and flames) */
  at?: [number, number];
  /** a flame's ordinal among the flames */
  flame?: number;
  /** a flame's parent cut's centre, whose huddle shift it rides */
  parentAt?: [number, number];
};

export type LayerPlacement = {
  position: Frame;
  /** the mesh's uniform scale: the extra depth buys parallax rather than zoom */
  scale: number;
  uRelief: number;
  uCamZ: number;
  uLayerZ: number;
  uScale: number;
};

export type PlacementFrame = Pick<FramePlan, "zScale" | "relief" | "flock"> & {
  baseZ: number;
  /** the dove cut's authored z, when the set has one */
  doveZ?: number;
};

/**
 * Where a layer sits this frame. The spread pushes the cuts apart and the
 * rescale keeps their apparent size; the relief uniforms follow, per frame,
 * because the live z moves with the scroll and baseZ with resizes. The
 * huddle (parallaxRelief.ts) slides a figure toward the centre line by a
 * fraction of its offset from it, in the plate's units at its live depth —
 * the plate is kn = (baseZ − zn)/baseZ times its z=0 size there.
 *
 * A flame leaves its head for the dove (flamePose.ts). Composition: the
 * spread transform puts its plane at zn, scaled so the cut registers as at
 * the hero; on top of that, in world space, the flame's centre (`at` — an
 * offset of (u−0.5)·w·kn from the mesh origin) is carried to the pose. The
 * scale is left alone on purpose: a tongue shrinks with bare perspective as
 * it sinks toward the dove, which is what makes it read as receding rather
 * than sliding. At rest the tongue also wears its parent's huddle shift, so
 * it stays on the head that moved.
 */
export function placeLayer(layer: LayerRest, frame: PlacementFrame, plate = PLATE): LayerPlacement {
  const { baseZ, zScale } = frame;
  const zn = layer.z * zScale;
  const ru = reliefUniforms(baseZ, layer.z, zn);
  const kn = (baseZ - zn) / baseZ;
  const base = {
    scale: (baseZ - zn) / (baseZ - layer.z),
    uRelief: layer.relief * frame.relief,
    uCamZ: ru.uCamZ,
    uLayerZ: ru.uLayerZ,
    uScale: ru.uScale,
  };
  if (layer.flame === undefined || !layer.at) {
    return { ...base, position: { x: huddleShift(layer.at) * plate.w * kn, y: 0, z: zn } };
  }
  const zd = (frame.doveZ ?? DOVE_FALLBACK_Z) * zScale;
  const kd = (baseZ - zd) / baseZ;
  const cx = (layer.at[0] - 0.5) * plate.w * kn;
  const cy = (0.5 - layer.at[1]) * plate.h * kn;
  const pose = flamePose(layer.flame, frame.flock, {
    rest: { x: cx + huddleShift(layer.parentAt) * plate.w * kn, y: cy, z: zn },
    dove: { x: 0, y: (0.5 - DOVE_V) * plate.h * kd, z: zd },
  });
  return { ...base, position: { x: pose.x - cx, y: pose.y - cy, z: pose.z } };
}
