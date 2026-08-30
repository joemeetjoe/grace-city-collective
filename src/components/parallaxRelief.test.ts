import { describe, expect, it } from "vitest";

import {
  flameKey,
  FLAME_LIFT,
  HUDDLE,
  bindFlames,
  displaceLocal,
  huddleShift,
  parseCuts,
  rectToUv,
  reliefDz,
  reliefUniforms,
  segmentsFor,
} from "./parallaxRelief";

describe("parseCuts", () => {
  it("defaults legacy entries without a relief flag to flat", () => {
    const cuts = parseCuts([
      { name: "crowd", z: -0.9, isFlame: 0 },
      { name: "fig3", z: 1.78, isFlame: 0, relief: 1 },
    ]);

    expect(cuts).toEqual([
      { name: "crowd", z: -0.9, isFlame: 0, relief: 0 },
      { name: "fig3", z: 1.78, isFlame: 0, relief: 1 },
    ]);
  });

  it("carries a cut's dedicated color map through, absent on legacy entries", () => {
    const cuts = parseCuts([
      { name: "crowd", z: -0.9, isFlame: 0, map: "map-crowd.jpg" },
      { name: "fig3", z: 1.78, isFlame: 0, relief: 1 },
    ]);

    expect(cuts[0].map).toBe("map-crowd.jpg");
    expect(cuts[1].map).toBeUndefined();
  });

  it("carries a cut's packed mask reference through, absent on legacy entries", () => {
    const cuts = parseCuts([
      { name: "fig5", z: 2.3, isFlame: 0, relief: 1, mask: { file: "masks-cut-0.webp", channel: 1 } },
      { name: "arch", z: -2.8, isFlame: 0 },
    ]);

    expect(cuts[0].mask).toEqual({ file: "masks-cut-0.webp", channel: 1 });
    expect(cuts[1].mask).toBeUndefined();
  });

  it("carries a figure's anchor through, absent on legacy entries", () => {
    const cuts = parseCuts([
      { name: "fig5", z: 2.3, isFlame: 0, relief: 1, at: [0.2679, 0.658] },
      { name: "fig1", z: 2.1, isFlame: 0, relief: 1 },
    ]);

    expect(cuts[0].at).toEqual([0.2679, 0.658]);
    expect(cuts[1].at).toBeUndefined();
  });

  it("carries a flame's parent through, absent on legacy entries", () => {
    const cuts = parseCuts([
      { name: "flame4", z: -1.7, isFlame: 1, parent: "fig4" },
      { name: "flame5", z: -1.4, isFlame: 1 },
    ]);

    expect(cuts[0].parent).toBe("fig4");
    expect(cuts[1].parent).toBeUndefined();
  });
});

describe("bindFlames", () => {
  const cuts = parseCuts([
    { name: "fig5", z: 2.3, isFlame: 0, relief: 1 },
    { name: "crowd", z: -0.9, isFlame: 0, map: "map-crowd.jpg" },
    { name: "flame5", z: -1.4, isFlame: 1, parent: "fig5" },
    { name: "flame6", z: -2.0, isFlame: 1, parent: "crowd" },
    { name: "flame7", z: -1.7, isFlame: 1, parent: "fig99" },
    { name: "flame8", z: -1.4, isFlame: 1 },
  ]);

  it("rests each flame just in front of its parent, on the same plane", () => {
    const z = Object.fromEntries(bindFlames(cuts).map((c) => [c.name, c.z]));

    expect(z.flame5).toBeCloseTo(2.3 + FLAME_LIFT, 12);
    expect(z.flame6).toBeCloseTo(-0.85, 12); // crowd heads stay on the crowd plane
  });

  it("leaves a flame with no parent in the scene at its authored z", () => {
    const z = Object.fromEntries(bindFlames(cuts).map((c) => [c.name, c.z]));

    expect(z.flame7).toBe(-1.7);
    expect(z.flame8).toBe(-1.4);
  });

  it("touches nothing but the bound flames' z", () => {
    const bound = bindFlames(cuts);

    expect(bound.map((c) => c.name)).toEqual(cuts.map((c) => c.name));
    expect(bound[0]).toEqual(cuts[0]);
    expect(bound[1]).toEqual(cuts[1]);
    expect(bound[2]).toEqual({ ...cuts[2], z: 2.3 + FLAME_LIFT });
    expect(cuts[2].z).toBe(-1.4); // input untouched
  });
});

describe("reliefDz", () => {
  it("pushes white toward the camera, black away, plate plane not at all", () => {
    expect(reliefDz(0.5, 0.5)).toBe(0);
    expect(reliefDz(1, 0.5)).toBeCloseTo(0.25, 12);
    expect(reliefDz(0, 0.5)).toBeCloseTo(-0.25, 12);
    expect(reliefDz(0.8, 0)).toBe(0);
  });
});

describe("reliefUniforms", () => {
  it("pins the registration camera and tracks the live layer state", () => {
    const baseZ = 15.8;
    const restZ = 2.6;

    const atRest = reliefUniforms(baseZ, restZ, restZ);
    expect(atRest).toEqual({ uCamZ: baseZ, uLayerZ: restZ, uScale: 1 });

    const liveZ = restZ * 1.6;
    const moved = reliefUniforms(baseZ, restZ, liveZ);
    expect(moved.uCamZ).toBe(baseZ);
    expect(moved.uLayerZ).toBe(liveZ);
    expect(moved.uScale).toBeCloseTo((baseZ - liveZ) / (baseZ - restZ), 12);
  });
});

describe("displaceLocal", () => {
  // The whole point of the compensation: from the registration camera at
  // (0, 0, baseZ) a displaced vertex must project exactly where the flat one
  // did, for every layer position the scroll can put the mesh in.
  it("is projection-invariant from the registration camera", () => {
    const baseZ = 15.8;
    for (const restZ of [-3, 0.13, 2.6]) {
      for (const spreadFactor of [0.2, 1.0, 1.95]) {
        const liveZ = restZ * spreadFactor;
        const u = reliefUniforms(baseZ, restZ, liveZ);
        for (const depth of [0, 0.25, 0.5, 1]) {
          for (const uRelief of [0, 0.5, 2]) {
            for (const local of [
              { x: -10.5, y: -13.0 },
              { x: 10.5, y: 13.0 },
              { x: 1.7, y: -4.2 },
              { x: 0, y: 0 },
            ]) {
              const p = displaceLocal(local, depth, { ...u, uRelief });
              const worldZ = liveZ + p.z * u.uScale;
              const flatNdc = {
                x: (local.x * u.uScale) / (baseZ - liveZ),
                y: (local.y * u.uScale) / (baseZ - liveZ),
              };
              expect((p.x * u.uScale) / (baseZ - worldZ)).toBeCloseTo(flatNdc.x, 12);
              expect((p.y * u.uScale) / (baseZ - worldZ)).toBeCloseTo(flatNdc.y, 12);
            }
          }
        }
      }
    }
  });

  it("is an exact identity when relief is zero", () => {
    const u = { ...reliefUniforms(13.2, -3, -3 * 0.7), uRelief: 0 };
    const p = displaceLocal({ x: -7.13, y: 9.001 }, 0.83, u);
    expect(p).toEqual({ x: -7.13, y: 9.001, z: 0 });
  });

  it("moves the vertex by the world-space relief displacement", () => {
    const u = { ...reliefUniforms(15.8, 2.6, 2.6 * 1.6), uRelief: 0.5 };
    const p = displaceLocal({ x: 3, y: 5 }, 1, u);
    expect(p.z * u.uScale).toBeCloseTo(reliefDz(1, 0.5), 12);
  });
});

describe("segmentsFor", () => {
  it("keeps flat cuts as single quads and subdivides relief cuts", () => {
    expect(segmentsFor(0)).toEqual([1, 1]);
    expect(segmentsFor(1)).toEqual([96, 118]);
  });
});

describe("rectToUv", () => {
  it("is the whole plate when a cut has no map rectangle", () => {
    expect(rectToUv(undefined)).toEqual([0, 0, 1, 1]);
  });

  it("flips a top-down plate rectangle into bottom-up uv space", () => {
    // a rect 20% wide, 30% tall, whose top-left is 10% in and 20% down
    expect(rectToUv([0.1, 0.2, 0.2, 0.3])).toEqual([0.1, 0.5, 0.2, 0.3]);
    // the plate's bottom-most strip becomes v = 0
    expect(rectToUv([0, 0.9, 1, 0.1])[1]).toBeCloseTo(0, 12);
  });
});

describe("flameKey", () => {
  // a flame cut carries a rim of dark wall inside its feathered mask; it is
  // invisible on the wall but reads as a smudge once the flame rises into the
  // beam, so the flame's alpha is keyed on luminance
  it("keeps the bright tongue and drops the dark wall around it", () => {
    expect(flameKey(0.9)).toBe(1);
    expect(flameKey(0.05)).toBe(0);
  });

  it("ramps smoothly between the wall and the tongue", () => {
    const mid = flameKey(0.3);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(flameKey(0.2)).toBeLessThan(flameKey(0.4));
  });

  it("leaves non-flame cuts alone", () => {
    expect(flameKey(0.05, 0)).toBe(1);
  });
});

describe("huddleShift", () => {
  it("is nothing for a cut without an anchor, or one on the centre line", () => {
    expect(huddleShift(undefined)).toBe(0);
    expect(huddleShift([0.5, 0.7])).toBe(0);
  });

  it("slides a cut toward the centre from either side, in proportion to its offset", () => {
    // a figure at u 0.1 moves right; one at u 0.9 moves left by the same amount
    expect(huddleShift([0.1, 0.6])).toBeCloseTo(HUDDLE * 0.4, 12);
    expect(huddleShift([0.9, 0.6])).toBeCloseTo(-HUDDLE * 0.4, 12);
    // half the offset, half the shift
    expect(huddleShift([0.3, 0.6])).toBeCloseTo(HUDDLE * 0.2, 12);
  });

  it("scales with the huddle strength, and a zero huddle leaves every cut put", () => {
    expect(huddleShift([0.1, 0.6], 0.1)).toBeCloseTo(0.04, 12);
    expect(huddleShift([0.1, 0.6], 0)).toBe(0);
  });

  it("closes a gap between neighbours, not just scales it", () => {
    // two robes 0.15 apart on the plate: a rigid shift per figure brings
    // them closer by HUDDLE times their spacing, whatever the gap was
    const left = huddleShift([0.3, 0.6]);
    const right = huddleShift([0.45, 0.6]);
    expect(right - left).toBeCloseTo(-HUDDLE * 0.15, 12);
  });
});
