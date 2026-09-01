import { describe, expect, it } from "vitest";

import {
  ORBIT_LATERAL_FACTOR,
  budgetYaw,
  chase,
  orbitPose,
  reliefGain,
} from "./cameraOrbit";

const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe("orbitPose", () => {
  const eye = { x: 0.4, y: -1.2, z: 20 };
  const opts = { yawDeg: 3.5, pitchDeg: 2.5, slide: 0 };

  it("returns the frame unchanged when the pointer rests at centre", () => {
    const pose = orbitPose(eye, { x: 0, y: 0 }, opts);

    expect(pose.position).toEqual(eye);
    expect(pose.target).toEqual({ x: eye.x, y: eye.y, z: 0 });
  });

  it("yaws the camera around the look-at point by ±yaw at the pointer's extremes", () => {
    const right = orbitPose(eye, { x: 1, y: 0 }, opts);
    const left = orbitPose(eye, { x: -1, y: 0 }, opts);

    // the camera swings away from the cursor so the near figures follow it —
    // the sign the slide has always had
    const rad = (3.5 * Math.PI) / 180;
    expect(right.position.x).toBeCloseTo(eye.x - 20 * Math.sin(rad), 6);
    expect(right.position.z).toBeCloseTo(20 * Math.cos(rad), 6);
    expect(left.position.x).toBeCloseTo(eye.x + 20 * Math.sin(rad), 6);
    expect(right.target).toEqual({ x: eye.x, y: eye.y, z: 0 });
  });

  it("pitches by ±pitch, camera rising when the cursor is at the top", () => {
    const top = orbitPose(eye, { x: 0, y: -1 }, opts);
    const bottom = orbitPose(eye, { x: 0, y: 1 }, opts);

    const rad = (2.5 * Math.PI) / 180;
    expect(top.position.y).toBeCloseTo(eye.y + 20 * Math.sin(rad), 6);
    expect(bottom.position.y).toBeCloseTo(eye.y - 20 * Math.sin(rad), 6);
    expect(top.position.x).toBeCloseTo(eye.x, 6);
  });

  it("keeps the look-at fixed and the distance to it invariant under any orbit", () => {
    for (const p of [{ x: 1, y: 1 }, { x: -1, y: 0.3 }, { x: 0.2, y: -1 }, { x: -0.7, y: -0.7 }]) {
      const pose = orbitPose(eye, p, opts);
      expect(pose.target).toEqual({ x: eye.x, y: eye.y, z: 0 });
      expect(dist(pose.position, pose.target)).toBeCloseTo(20, 9);
    }
  });

  it("clamps the pointer to the unit square", () => {
    const far = orbitPose(eye, { x: 4, y: -9 }, opts);
    const edge = orbitPose(eye, { x: 1, y: -1 }, opts);

    expect(far.position).toEqual(edge.position);
  });

  it("slides the whole frame with the pointer on top of the orbit", () => {
    const pose = orbitPose(eye, { x: 1, y: -1 }, { ...opts, slide: 0.12 });
    const pure = orbitPose(eye, { x: 1, y: -1 }, opts);

    // the slide pans target and camera together, same sign as the orbit
    expect(pose.target).toEqual({ x: eye.x - 0.12, y: eye.y + 0.12, z: 0 });
    expect(pose.position.x).toBeCloseTo(pure.position.x - 0.12, 9);
    expect(pose.position.y).toBeCloseTo(pure.position.y + 0.12, 9);
    expect(dist(pose.position, pose.target)).toBeCloseTo(20, 9);
  });

  it("confines the slid frame centre to the lateral budget, never the orbit", () => {
    const slid = orbitPose(eye, { x: 1, y: 1 }, { ...opts, slide: 0.5, limit: { x: 0.2, y: 0.05 } });

    // eye.x - 0.5 would be -0.1, inside ±0.2; eye.y - 0.5 = -1.7 is clamped to -0.05
    expect(slid.target.x).toBeCloseTo(-0.1, 12);
    expect(slid.target.y).toBe(-0.05);
    expect(slid.target.z).toBe(0);
    expect(dist(slid.position, slid.target)).toBeCloseTo(20, 9);
    // the orbit still swings the camera past the slide's limit
    expect(Math.abs(slid.position.x - slid.target.x)).toBeGreaterThan(0.2);
  });
});

describe("budgetYaw / the wall guard", () => {
  // the slide's lateral budget at the hero (IW * LATERAL_MAX in the scene)
  const budget = 16 * 0.06;

  it("limits the yaw so the orbit's lateral travel stays within the budget times the factor", () => {
    for (const d of [20, 12, 8, 4]) {
      const yaw = budgetYaw(d, budget);
      const pose = orbitPose({ x: 0, y: 0, z: d }, { x: 1, y: 0 }, { yawDeg: yaw, pitchDeg: 0, slide: 0 });
      expect(Math.abs(pose.position.x)).toBeLessThanOrEqual(budget * ORBIT_LATERAL_FACTOR + 1e-9);
      expect(Math.abs(pose.position.x)).toBeCloseTo(Math.min(d, budget * ORBIT_LATERAL_FACTOR), 9);
    }
  });

  it("never exceeds the requested yaw", () => {
    expect(Math.min(3.5, budgetYaw(4, budget))).toBe(3.5);
    expect(budgetYaw(20, budget)).toBeLessThan(90);
  });

  it("is 90° when the camera is closer than the budget", () => {
    expect(budgetYaw(0.5, budget)).toBe(90);
  });
});

describe("reliefGain", () => {
  it("keeps the base relief with the pointer at centre", () => {
    expect(reliefGain(0, 0.5, 0.8)).toBe(0.5);
  });

  it("ramps symmetrically to the maximum at either edge", () => {
    expect(reliefGain(1, 0.5, 0.8)).toBeCloseTo(0.8, 9);
    expect(reliefGain(-1, 0.5, 0.8)).toBeCloseTo(0.8, 9);
    expect(reliefGain(0.5, 0.5, 0.8)).toBeCloseTo(0.65, 9);
    expect(reliefGain(-0.5, 0.5, 0.8)).toBeCloseTo(reliefGain(0.5, 0.5, 0.8), 9);
  });

  it("clamps beyond the edges and defaults to the scene's 0.5 → 0.8", () => {
    expect(reliefGain(3)).toBeCloseTo(0.8, 9);
    expect(reliefGain(-3)).toBeCloseTo(0.8, 9);
    expect(reliefGain(0)).toBe(0.5);
  });

  it("never drops below the base when the max is set under it", () => {
    expect(reliefGain(1, 0.5, 0.3)).toBe(0.5);
  });
});

describe("chase", () => {
  const integrate = (fps: number, seconds: number, k0 = 0.08) => {
    let x = 0;
    const dt = 1 / fps;
    for (let i = 0; i < Math.round(fps * seconds); i++) x += (1 - x) * chase(k0, dt);
    return x;
  };

  it("matches a per-frame factor at the reference frame rate", () => {
    expect(chase(0.08, 1 / 60)).toBeCloseTo(0.08, 12);
    expect(chase(0.045, 1 / 60)).toBeCloseTo(0.045, 12);
  });

  it("covers the same ground over a second at 60 fps, 30 fps and 144 fps", () => {
    const perSecond = 1 - Math.pow(1 - 0.08, 60);
    expect(integrate(60, 1)).toBeCloseTo(perSecond, 9);
    expect(integrate(30, 1)).toBeCloseTo(perSecond, 9);
    expect(integrate(144, 1)).toBeCloseTo(perSecond, 6);
  });

  it("never overshoots and stalls on a zero step", () => {
    expect(chase(0.08, 0)).toBe(0);
    expect(chase(0.08, 10)).toBeLessThanOrEqual(1);
    expect(chase(0.08, 10)).toBeGreaterThan(0.999);
  });

  it("is a no-op for a degenerate factor", () => {
    expect(chase(0, 1 / 60)).toBe(0);
    expect(chase(1, 1 / 60)).toBe(1);
  });
});
