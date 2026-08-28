import { describe, expect, it } from "vitest";

import {
  EMBER_COUNT,
  EMBER_FIELD,
  EMBER_SIZE,
  EMBER_SPEED,
  EMBER_Z,
  advance,
  createEmberState,
  emberCount,
  emberOpacity,
  emberPose,
  emberWindow,
  seedEmbers,
  wrapInto,
} from "./embers";

const desktop = { width: 1280, height: 720, dpr: 1, reducedMotion: false } as const;

describe("emberCount", () => {
  it("is nothing under reduced motion, whatever the viewport", () => {
    expect(emberCount({ ...desktop, reducedMotion: true })).toBe(0);
    expect(emberCount({ width: 2560, height: 1440, dpr: 2, reducedMotion: true, tier: "mobile" })).toBe(0);
  });

  it("is a fixed handful on the mobile tier", () => {
    expect(emberCount({ width: 390, height: 844, dpr: 3, reducedMotion: false, tier: "mobile" })).toBe(
      EMBER_COUNT.mobile,
    );
  });

  it("starts at the floor on a small desktop viewport and grows with area and DPR", () => {
    const small = emberCount(desktop);
    const wide = emberCount({ ...desktop, width: 1600, height: 900 });
    const retina = emberCount({ ...desktop, width: 1600, height: 900, dpr: 2 });
    expect(small).toBe(EMBER_COUNT.min);
    expect(wide).toBeGreaterThan(small);
    expect(retina).toBeGreaterThan(wide);
  });

  it("never leaves the desktop band", () => {
    expect(emberCount({ ...desktop, width: 640, height: 400 })).toBe(EMBER_COUNT.min);
    expect(emberCount({ ...desktop, width: 3840, height: 2160, dpr: 3 })).toBe(EMBER_COUNT.max);
  });
});

describe("seedEmbers", () => {
  const seeds = seedEmbers(200, 7);

  it("is deterministic for a seed and differs across seeds", () => {
    expect(seedEmbers(200, 7)).toEqual(seeds);
    expect(seedEmbers(200, 8).origin).not.toEqual(seeds.origin);
  });

  it("scatters every ember over the plate's extent, between the floor and the camera", () => {
    expect(seeds.count).toBe(200);
    expect(seeds.origin).toHaveLength(600);
    for (let i = 0; i < seeds.count; i++) {
      const x = seeds.origin[i * 3];
      const y = seeds.origin[i * 3 + 1];
      const z = seeds.origin[i * 3 + 2];
      expect(Math.abs(x)).toBeLessThanOrEqual(EMBER_FIELD.halfW);
      expect(Math.abs(y)).toBeLessThanOrEqual(EMBER_FIELD.halfH);
      expect(z).toBeGreaterThanOrEqual(EMBER_Z.min);
      expect(z).toBeLessThanOrEqual(EMBER_Z.max);
    }
  });

  it("hangs in the air: the vertical settle is tiny and goes either way", () => {
    for (const v of seeds.speed) {
      expect(v).toBeGreaterThanOrEqual(EMBER_SPEED.min);
      expect(v).toBeLessThanOrEqual(EMBER_SPEED.max);
    }
    expect(EMBER_SPEED.max).toBeLessThanOrEqual(0.02);
    expect(Array.from(seeds.speed).some((v) => v < 0)).toBe(true);
    expect(Array.from(seeds.speed).some((v) => v > 0)).toBe(true);
  });

  it("sizes by depth: the nearest embers are all larger than the farthest", () => {
    const near: number[] = [];
    const far: number[] = [];
    for (let i = 0; i < seeds.count; i++) {
      const z = seeds.origin[i * 3 + 2];
      if (z > EMBER_Z.max - 0.2) near.push(seeds.size[i]);
      if (z < EMBER_Z.min + 0.2) far.push(seeds.size[i]);
    }
    expect(near.length).toBeGreaterThan(0);
    expect(far.length).toBeGreaterThan(0);
    expect(Math.min(...near)).toBeGreaterThan(Math.max(...far));
    for (const s of seeds.size) {
      expect(s).toBeGreaterThanOrEqual(EMBER_SIZE.min);
      expect(s).toBeLessThanOrEqual(EMBER_SIZE.max);
    }
  });

  it("gives an empty layer for a count of zero", () => {
    expect(seedEmbers(0).count).toBe(0);
    expect(seedEmbers(0).origin).toHaveLength(0);
  });
});

describe("wrapInto", () => {
  it("leaves a value inside the window alone", () => {
    expect(wrapInto(0.4, 0, 1)).toBeCloseTo(0.4);
    expect(wrapInto(2.9, 3, 1)).toBeCloseTo(2.9);
  });

  it("brings a value past the top back in at the bottom, and vice versa", () => {
    expect(wrapInto(1.25, 0, 1)).toBeCloseTo(-0.75);
    expect(wrapInto(-1.25, 0, 1)).toBeCloseTo(0.75);
    expect(wrapInto(10.5, 5, 2)).toBeCloseTo(6.5);
  });
});

describe("emberWindow", () => {
  it("follows the camera laterally, sized to the registration frustum at the ember's depth plus the margin", () => {
    const w = emberWindow({ x: 1, y: 2 }, 4, 12, 0.5, 2, 1.1);
    expect(w.cx).toBe(1);
    expect(w.cy).toBe(2);
    expect(w.halfH).toBeCloseTo(8 * 0.5 * 1.1);
    expect(w.halfW).toBeCloseTo(8 * 0.5 * 1.1 * 2);
  });

  it("holds its size while the camera dollies, so the cloud's density never changes", () => {
    const far = emberWindow({ x: 0, y: 0 }, 4, 12, 0.5, 2);
    const near = emberWindow({ x: 0, y: 9 }, 4, 12, 0.5, 2);
    expect(near.halfH).toBe(far.halfH);
    expect(near.cy).toBe(9);
  });
});

describe("emberPose / advance", () => {
  const window = { cx: 0, cy: 0, halfW: EMBER_FIELD.halfW, halfH: EMBER_FIELD.halfH };

  it("holds its place: dust, not sparks — a mote barely moves over ten seconds", () => {
    const seeds = seedEmbers(20, 3);
    for (let i = 0; i < seeds.count; i++) {
      const a = emberPose(seeds, i, 0, window);
      const b = emberPose(seeds, i, 10, window);
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeLessThan(0.25);
    }
  });

  it("re-enters on the far side when the camera's window slides past it", () => {
    const seeds = seedEmbers(1, 3);
    const x0 = seeds.origin[0];
    const slid = { ...window, cx: x0 + window.halfW + 0.5 };
    const p = emberPose(seeds, 0, 0, slid);
    expect(p.x).toBeGreaterThan(x0 + 1);
    expect(Math.abs(p.x - slid.cx)).toBeLessThanOrEqual(window.halfW);
  });

  it("wobbles laterally within its amplitude and holds its depth", () => {
    const seeds = seedEmbers(1, 3);
    const x0 = seeds.origin[0];
    for (let t = 0; t < 10; t += 0.25) {
      const p = emberPose(seeds, 0, t, window);
      expect(Math.abs(p.x - x0)).toBeLessThanOrEqual(seeds.wobble[0] + 1e-9);
      expect(p.z).toBe(seeds.origin[2]);
    }
  });

  it("advance accumulates time and rewrites every position", () => {
    const state = createEmberState(seedEmbers(8, 5));
    const before = Float32Array.from(state.positions);
    advance(state, 0.5, window);
    advance(state, 0.5, window);
    expect(state.time).toBeCloseTo(1);
    for (let i = 0; i < 8; i++) {
      const p = emberPose(state.seeds, i, 1, window);
      expect(state.positions[i * 3]).toBeCloseTo(p.x, 5);
      expect(state.positions[i * 3 + 1]).toBeCloseTo(p.y, 5);
      expect(state.positions[i * 3 + 2]).toBeCloseTo(p.z, 5);
    }
    expect(state.positions).not.toEqual(before);
  });
});

describe("emberOpacity", () => {
  it("is full through the scene and at the last stop", () => {
    expect(emberOpacity(0, 6)).toBe(1);
    expect(emberOpacity(2.7, 6)).toBe(1);
    expect(emberOpacity(5, 6)).toBe(1);
  });

  it("fades across the last section, gone as the scene has scrolled away", () => {
    const mid = emberOpacity(5.5, 6);
    expect(mid).toBeLessThan(1);
    expect(mid).toBeGreaterThan(0.5);
    expect(emberOpacity(5.9, 6)).toBeLessThan(mid);
    expect(emberOpacity(6, 6)).toBe(0);
    expect(emberOpacity(7, 6)).toBe(0);
  });

  it("is full when there is no scene to fade across", () => {
    expect(emberOpacity(0, 0)).toBe(1);
    expect(emberOpacity(0.5, 1)).toBe(1);
  });
});
