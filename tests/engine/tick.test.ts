import { describe, expect, it } from "vitest";

import { registrationDistance, solveCamera } from "@/engine/cameraSolve";
import { ascentProgress, flamePose, ringSeat } from "@/engine/flamePose";
import { HUDDLE, reliefUniforms } from "@/engine/parallaxRelief";
import { createTickState, placeLayer, tickFrame, type SceneOptions, type TickInput, type TickState } from "@/engine/tick";
import { DOVE_V, PLATE, SCENE_DEFAULTS } from "@/engine/tuning";

const ASPECT = 16 / 9;
const baseZ = registrationDistance(ASPECT);

/** a pacer that renders every frame at a fixed dust rate, and a scroll ratio that records the speeds it saw */
function fakes(render = true, emberRate = 1) {
  const speeds: number[] = [];
  return {
    speeds,
    pacer: { frame: () => ({ render, emberRate }) },
    scrollDpr: {
      forSpeed(v: number) {
        speeds.push(v);
        return v > 900 ? 1 : 2;
      },
    },
  };
}

function input(over: Partial<TickInput> = {}, opts: Partial<SceneOptions> = {}): TickInput {
  return {
    now: 1000,
    t: 1,
    scrollY: 0,
    progress: 0,
    sectionCount: 6,
    aspect: ASPECT,
    baseZ,
    reducedMotion: false,
    opts: { ...SCENE_DEFAULTS, ...opts },
    ...over,
  };
}

/** a state one frame in: the camera initialised on the hero frame */
function primed(f = fakes()): TickState {
  const state = createTickState(f);
  tickFrame(state, input());
  return state;
}

describe("tickFrame", () => {
  it("lands the camera on its target on the first frame, looking straight at the plate", () => {
    const state = createTickState(fakes());
    const plan = tickFrame(state, input());
    if (!plan.render) throw new Error("expected a frame");
    const { target } = solveCamera({ sp: 0, aspect: ASPECT, baseZ });
    expect(state.cam.init).toBe(true);
    expect(state.cam).toMatchObject(target);
    // no pointer: the orbit is the identity and the look-at is the frame centre
    expect(plan.pose.position.z).toBeCloseTo(target.z, 9);
    expect(plan.pose.target).toEqual({ x: target.x, y: target.y, z: 0 });
    expect(plan.flock).toBe(ascentProgress(0));
    expect(plan.stop).toBe(0);
    expect(state.dirty).toBe(false);
  });

  it("skips the draw when the pacer says so, and parks only once the dust has stopped with nothing moving", () => {
    const asleep = primed();
    asleep.settled = true;
    asleep.pacer = fakes(false, 1).pacer;
    expect(tickFrame(asleep, input(undefined, { idleDrift: false }))).toEqual({ render: false, park: false });
    const stopped = createTickState(fakes(false, 0));
    stopped.dirty = false;
    stopped.settled = true;
    stopped.drawnScroll = 0;
    expect(tickFrame(stopped, input())).toEqual({ render: false, park: true });
    // a pointer still en route keeps it awake
    stopped.pointer.tx = 0.5;
    expect(tickFrame(stopped, input())).toEqual({ render: false, park: false });
  });

  it("chases the pointer and the camera at one framerate-independent rate, and reports settled only once both converge", () => {
    const state = primed();
    state.pointer.tx = 1;
    const a = tickFrame(state, input({ t: 1.016, progress: 1 }));
    if (!a.render) throw new Error("expected a frame");
    expect(state.pointer.x).toBeGreaterThan(0);
    expect(state.pointer.x).toBeLessThan(1);
    const { target } = solveCamera({ sp: 1, aspect: ASPECT, baseZ });
    expect(state.cam.z).toBeGreaterThan(Math.min(target.z, baseZ * 0.99));
    expect(state.settled).toBe(false);
    // the orbit swings the camera away from the cursor: cursor right, camera left of the frame centre
    expect(a.pose.position.x).toBeLessThan(a.pose.target.x);
    let t = 1.016;
    for (let i = 0; i < 2000 && !state.settled; i++) tickFrame(state, input({ t: (t += 0.016), progress: 1 }));
    expect(state.settled).toBe(true);
    expect(state.cam.z).toBeCloseTo(target.z, 3);
  });

  it("reads the scroll's speed frame to drawn frame and hands back the ratio for it", () => {
    const f = fakes();
    const state = primed(f);
    const plan = tickFrame(state, input({ t: 1.1, scrollY: 200 }));
    if (!plan.render) throw new Error("expected a frame");
    expect(f.speeds.at(-1)).toBeCloseTo(2000, 6);
    expect(plan.dpr).toBe(1);
    expect(state.drawnScroll).toBe(200);
  });

  it("advances the ember clock by drawn time × the dust rate, clamped against a long gap", () => {
    // the priming frame's own gap (one second from a fresh state) was clamped to 0.1 s
    const state = primed(fakes(true, 0.5));
    expect(state.emberT).toBeCloseTo(0.05, 9);
    tickFrame(state, input({ t: 1.05 }));
    expect(state.emberT).toBeCloseTo(0.075, 9);
    tickFrame(state, input({ t: 5 }));
    expect(state.emberT).toBeCloseTo(0.125, 9);
  });

  it("clamps the section progress to the last section for the camera but hands the embers the raw value", () => {
    const state = primed();
    const plan = tickFrame(state, input({ t: 1.016, progress: 7.5 }));
    if (!plan.render) throw new Error("expected a frame");
    expect(plan.sp).toBe(5);
    expect(plan.progress).toBe(7.5);
    expect(plan.stop).toBe(5);
    expect(plan.zScale).toBeCloseTo(1.35, 9);
  });

  it("clamps the layer spread and keeps the beam at its scene-wide intensity", () => {
    const state = primed();
    const plan = tickFrame(state, input({ t: 1.016 }, { layerSpread: 9 }));
    if (!plan.render) throw new Error("expected a frame");
    expect(plan.zScale).toBe(1.6);
    expect(plan.beam).toBeGreaterThan(0);
    expect(plan.relief).toBe(SCENE_DEFAULTS.figureRelief);
  });
});

describe("placeLayer", () => {
  const frame = { baseZ, zScale: 1.2, relief: 0.6, flock: 0, doveZ: -4.8 };

  it("pushes a cut to its spread depth and rescales it so its apparent size holds", () => {
    const p = placeLayer({ z: 2, relief: 0.5 }, frame);
    expect(p.position.z).toBeCloseTo(2.4, 9);
    expect(p.scale).toBeCloseTo((baseZ - 2.4) / (baseZ - 2), 9);
    expect(p.uRelief).toBeCloseTo(0.3, 9);
    expect({ uCamZ: p.uCamZ, uLayerZ: p.uLayerZ, uScale: p.uScale }).toEqual(reliefUniforms(baseZ, 2, 2.4));
  });

  it("huddles a figure toward the centre line in the plate's units at its live depth", () => {
    const p = placeLayer({ z: 1, relief: 0, at: [0.3, 0.5] }, frame);
    const kn = (baseZ - 1.2) / baseZ;
    expect(p.position.x).toBeCloseTo(HUDDLE * 0.2 * PLATE.w * kn, 9);
    expect(p.position.y).toBe(0);
    expect(placeLayer({ z: -5.6, relief: 0 }, frame).position.x).toBe(0);
  });

  it("rests a flame on its parent's huddled head, and carries it to its seat under the dove", () => {
    const layer = { z: 1, relief: 0, at: [0.4, 0.3] as [number, number], flame: 0, parentAt: [0.4, 0.5] as [number, number] };
    const rest = placeLayer(layer, frame);
    const kn = (baseZ - 1.2) / baseZ;
    // the mesh origin is offset from the flame's centre by the parent's huddle alone
    expect(rest.position.x).toBeCloseTo(HUDDLE * 0.1 * PLATE.w * kn, 9);
    expect(rest.position.y).toBeCloseTo(0, 9);
    expect(rest.position.z).toBeCloseTo(1.2, 9);
    const flown = placeLayer(layer, { ...frame, flock: 1 });
    const zd = -4.8 * 1.2;
    const kd = (baseZ - zd) / baseZ;
    const cx = (0.4 - 0.5) * PLATE.w * kn;
    const cy = (0.5 - 0.3) * PLATE.h * kn;
    const pose = flamePose(0, 1, { rest: { x: 0, y: 0, z: 0 }, dove: { x: 0, y: (0.5 - DOVE_V) * PLATE.h * kd, z: zd } });
    expect(flown.position.x).toBeCloseTo(pose.x - cx, 9);
    expect(flown.position.y).toBeCloseTo(pose.y - cy, 9);
    expect(flown.position.z).toBeCloseTo(pose.z, 9);
    expect(pose.x).toBeCloseTo(ringSeat(0).x, 9);
  });
});
