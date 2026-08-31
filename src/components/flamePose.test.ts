import { describe, expect, it } from "vitest";

import {
  ASCENT_END,
  ASCENT_START,
  DOVE_Z_EPS,
  FLAME_COUNT,
  RING,
  ascentProgress,
  flameFraction,
  flamePose,
  flameTiming,
  ringSeat,
  type Vec3,
} from "./flamePose";

// the tick loop's world units: the plate is IW wide, IH tall, centred on the
// origin with y up; the dove sits at v 0.033 on the z = -3.0 plane
const IW = 16;
const IH = IW * (2519 / 2048);
const dove: Vec3 = { x: 0, y: (0.5 - 0.033) * IH, z: -3.0 };
// a flame on a head: fig4's tongue at u 0.19, v 0.47 on its parent's plane
const rest: Vec3 = { x: (0.19 - 0.5) * IW, y: (0.5 - 0.47) * IH, z: 2.05 };

const indices = Array.from({ length: FLAME_COUNT }, (_, i) => i);
const dist = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe("ascentProgress", () => {
  it("holds at 0 through the hero and reaches 1 by Give", () => {
    expect(ASCENT_START).toBe(1);
    expect(ASCENT_END).toBe(4);
    expect(ascentProgress(0)).toBe(0);
    expect(ascentProgress(0.99)).toBe(0);
    expect(ascentProgress(1)).toBe(0);
    expect(ascentProgress(2.5)).toBeCloseTo(0.5, 9);
    expect(ascentProgress(4)).toBe(1);
    expect(ascentProgress(5)).toBe(1);
  });

  it("is forced to 0 for reduced motion, so the flames stay on their heads", () => {
    expect(ascentProgress(2.5, true)).toBe(0);
    expect(ascentProgress(5, true)).toBe(0);
  });
});

describe("flamePose", () => {
  it("puts every flame exactly on its head at progress 0", () => {
    for (const i of indices) {
      expect(flamePose(i, 0, { rest, dove })).toEqual(rest);
    }
  });

  it("gathers every flame into a loose ring beneath the dove at progress 1", () => {
    for (const i of indices) {
      const p = flamePose(i, 1, { rest, dove });
      expect(p.y).toBeLessThan(dove.y - RING.drop + RING.radius * RING.squash);
      expect(p.y).toBeGreaterThan(dove.y - RING.drop - RING.radius * RING.squash);
      expect(Math.abs(p.x - dove.x)).toBeLessThanOrEqual(RING.radius);
      // beneath, not on: no flame sits on the dove itself
      expect(dist(p, { ...dove, z: p.z })).toBeGreaterThan(RING.drop - RING.radius * RING.squash);
    }
  });

  it("seats each flame at its own place on the ring", () => {
    const seats = new Set(indices.map((i) => JSON.stringify(ringSeat(i))));
    expect(seats.size).toBe(FLAME_COUNT);
    for (const i of indices) {
      const s = ringSeat(i);
      expect(Math.hypot(s.x, (s.y + RING.drop) / RING.squash)).toBeLessThanOrEqual(RING.radius);
    }
  });

  it("never lets a flame's distance to its seat grow as progress increases", () => {
    for (const i of indices) {
      const seat = flamePose(i, 1, { rest, dove });
      let last = Number.POSITIVE_INFINITY;
      for (let p = 0; p <= 1.0001; p += 0.005) {
        const d = dist(flamePose(i, p, { rest, dove }), seat);
        expect(d).toBeLessThanOrEqual(last + 1e-9);
        last = d;
      }
      expect(last).toBeCloseTo(0, 9);
    }
  });

  it("staggers the flames: mid-ascent they are at visibly different fractions", () => {
    const half = indices.map((i) => flameFraction(i, 0.5));
    expect(new Set(half).size).toBeGreaterThan(1);
    // two thirds in (the Gatherings frame): some still low, some nearly seated
    const later = indices.map((i) => flameFraction(i, 0.67));
    expect(Math.max(...later) - Math.min(...later)).toBeGreaterThan(0.3);
    expect(later.some((f) => f > 0 && f < 1)).toBe(true);
  });

  it("gives each flame a deterministic start delay and speed within the ascent", () => {
    for (const i of indices) {
      const a = flameTiming(i);
      expect(a).toEqual(flameTiming(i));
      expect(a.start).toBeGreaterThanOrEqual(0);
      expect(a.start).toBeLessThanOrEqual(0.85);
      expect(a.end).toBeLessThanOrEqual(1);
      expect(a.end - a.start).toBeGreaterThanOrEqual(0.14);
      expect(flameFraction(i, a.start)).toBe(0);
      expect(flameFraction(i, a.end)).toBe(1);
    }
    const starts = new Set(indices.map((i) => flameTiming(i).start));
    expect(starts.size).toBeGreaterThan(FLAME_COUNT / 2);
  });

  it("sinks from the parent's plane to just in front of the dove's as it rises", () => {
    for (const i of indices) {
      expect(flamePose(i, 1, { rest, dove }).z).toBeCloseTo(dove.z + DOVE_Z_EPS, 9);
      const { start, end } = flameTiming(i);
      const mid = flamePose(i, (start + end) / 2, { rest, dove }).z;
      expect(mid).toBeLessThan(rest.z);
      expect(mid).toBeGreaterThan(dove.z + DOVE_Z_EPS);
    }
  });

  it("holds a lifted flame perfectly still: the pose is a function of progress alone (#63)", () => {
    for (const i of indices) {
      const seated = flamePose(i, 1, { rest, dove });
      expect(flamePose(i, 1, { rest, dove })).toEqual(seated);
      const { start, end } = flameTiming(i);
      const mid = (start + end) / 2;
      expect(flamePose(i, mid, { rest, dove })).toEqual(flamePose(i, mid, { rest, dove }));
    }
  });
});
