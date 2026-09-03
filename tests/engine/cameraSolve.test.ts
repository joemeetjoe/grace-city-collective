import { describe, expect, it } from "vitest";

import { halfTan, registrationDistance, solveCamera, solveWaypoint } from "@/engine/cameraSolve";
import { CAMERA, DOVE_V, FRAME, LATERAL_MAX, PLATE } from "@/engine/tuning";
import { WAYPOINTS, type Waypoint } from "@/engine/waypoints";

const LANDSCAPE = 16 / 9;
const PORTRAIT = 390 / 844;

describe("registrationDistance", () => {
  it("cover-fits the plate at the camera's fov: width-limited on a landscape frame, height-limited on a portrait one", () => {
    const tan = halfTan(CAMERA.fov);
    expect(registrationDistance(LANDSCAPE)).toBeCloseTo((CAMERA.cover * PLATE.w) / 2 / (tan * LANDSCAPE), 9);
    expect(registrationDistance(PORTRAIT)).toBeCloseTo((CAMERA.cover * PLATE.h) / 2 / tan, 9);
  });

  it("never grows with a wider frame", () => {
    let last = Number.POSITIVE_INFINITY;
    for (const aspect of [0.4, 0.6, 0.8, 1, 1.3, 1.78, 2.4]) {
      const d = registrationDistance(aspect);
      expect(d).toBeLessThanOrEqual(last);
      last = d;
    }
  });
});

describe("solveWaypoint", () => {
  const baseZ = registrationDistance(LANDSCAPE);

  it("sits at the distance that makes the band fill the frame vertically, centred on the band, offset by u", () => {
    const wp: Waypoint = { band: [0.3, 0.6], u: 0.05 };
    const f = solveWaypoint(wp, { baseZ, aspect: LANDSCAPE });
    expect(f.z * halfTan() * 2).toBeCloseTo(0.3 * PLATE.h, 9);
    expect(f.y).toBeCloseTo((0.5 - 0.45) * PLATE.h, 9);
    expect(f.x).toBeCloseTo(0.05 * PLATE.w, 9);
  });

  it("clamps the dolly between the registration distance and its nearest fraction of it", () => {
    expect(solveWaypoint({ band: [0, 1] }, { baseZ, aspect: LANDSCAPE }).z).toBe(baseZ);
    expect(solveWaypoint({ band: [0.5, 0.501] }, { baseZ, aspect: LANDSCAPE }).z).toBeCloseTo(baseZ * FRAME.zMin, 9);
  });

  it("widens a band on a portrait frame — except the dove's", () => {
    const wide = solveWaypoint({ band: [0.3, 0.6] }, { baseZ, aspect: PORTRAIT });
    const tall = solveWaypoint({ band: [0.3, 0.6] }, { baseZ, aspect: LANDSCAPE });
    expect(wide.z).toBeGreaterThan(tall.z);
    const doveWide = solveWaypoint({ band: [0.3, 0.6], aim: "dove" }, { baseZ, aspect: PORTRAIT });
    expect(doveWide.z).toBeCloseTo(tall.z, 9);
  });

  it("aims at the dove's own plane: at 0.5 the dove sits dead centre, wherever its plane is", () => {
    const doveZ = -4.8;
    const wp: Waypoint = { band: [-0.02, 0.2], aim: "dove", at: 0.5 };
    const f = solveWaypoint(wp, { baseZ, aspect: LANDSCAPE, doveZ });
    expect(f.y).toBeCloseTo((0.5 - DOVE_V) * PLATE.h * ((baseZ - doveZ) / baseZ), 9);
    // higher in frame means the camera looks lower: y falls as `at` rises
    const high = solveWaypoint({ ...wp, at: 0.7 }, { baseZ, aspect: LANDSCAPE, doveZ });
    expect(high.y).toBeLessThan(f.y);
    // and the portrait seat takes over on a portrait frame
    const portrait = solveWaypoint({ ...wp, at: 0.7, atPortrait: 0.9 }, { baseZ, aspect: PORTRAIT, doveZ });
    const portraitAt = solveWaypoint({ ...wp, at: 0.9 }, { baseZ, aspect: PORTRAIT, doveZ });
    expect(portrait.y).toBeCloseTo(portraitAt.y, 9);
  });

  it("falls back to the band centre without a dove plane to aim at", () => {
    const wp: Waypoint = { band: [-0.02, 0.2], aim: "dove", at: 0.7 };
    expect(solveWaypoint(wp, { baseZ, aspect: LANDSCAPE }).y).toBeCloseTo((0.5 - 0.09) * PLATE.h, 9);
  });
});

describe("solveCamera", () => {
  const baseZ = registrationDistance(LANDSCAPE);
  const ctx = { baseZ, aspect: LANDSCAPE };

  it("holds the first waypoint through the first half of the hero, then eases toward the second", () => {
    const hero = solveWaypoint(WAYPOINTS[0], ctx);
    expect(solveCamera({ ...ctx, sp: 0 }).target).toEqual(solveCamera({ ...ctx, sp: 0.5 }).target);
    expect(solveCamera({ ...ctx, sp: 0 }).target.z).toBeCloseTo(hero.z, 9);
    const next = solveWaypoint(WAYPOINTS[1], ctx);
    const mid = solveCamera({ ...ctx, sp: 0.75 }).target;
    expect(mid.z).toBeCloseTo((hero.z + next.z) / 2, 9);
    expect(solveCamera({ ...ctx, sp: 1 }).target.z).toBeCloseTo(next.z, 9);
  });

  it("confines the frame centre to the lateral budget and the plate's reach", () => {
    const { target, limit } = solveCamera({ ...ctx, sp: 3, drift: { x: 100, y: 100 } });
    expect(limit.x).toBeLessThanOrEqual(PLATE.w * LATERAL_MAX);
    expect(target.x).toBe(limit.x);
    expect(target.y).toBe(limit.y);
    expect(limit.y).toBeCloseTo(PLATE.h * FRAME.yReach - target.z * halfTan(), 9);
  });

  it("adds the idle drift before clamping", () => {
    const still = solveCamera({ ...ctx, sp: 2 }).target;
    const drifted = solveCamera({ ...ctx, sp: 2, drift: { x: 0.01, y: -0.02 } }).target;
    expect(drifted.x - still.x).toBeCloseTo(0.01, 9);
    expect(drifted.y - still.y).toBeCloseTo(-0.02, 9);
    expect(drifted.z).toBe(still.z);
  });
});
