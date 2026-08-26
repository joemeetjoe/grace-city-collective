import { describe, expect, it } from "vitest";

import { displaceLocal, parseCuts, reliefDz, reliefUniforms, segmentsFor } from "./parallaxRelief";

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
