import { describe, expect, it } from "vitest";

import { MASK_PAD, bakeUv, maskBounds } from "./maskBounds";

describe("maskBounds", () => {
  it("pads a cut's measured box on every side, in plate fractions", () => {
    const [u0, v0, u1, v1] = maskBounds("fig1")!;
    // measured: [0.621, 0.497, 0.957, 0.83]
    expect(u0).toBeCloseTo(0.621 - MASK_PAD, 9);
    expect(v0).toBeCloseTo(0.497 - MASK_PAD, 9);
    expect(u1).toBeCloseTo(0.957 + MASK_PAD, 9);
    expect(v1).toBeCloseTo(0.83 + MASK_PAD, 9);
  });

  it("keeps the pad from running far past the plate, but leaves room for the border fade", () => {
    const floor = maskBounds("floor")!; // measured to the plate's edges
    expect(floor[0]).toBeGreaterThanOrEqual(-0.01);
    expect(floor[3]).toBeLessThanOrEqual(1.01);
  });


  it("falls back to nothing for an unmeasured cut, so it keeps its full plane", () => {
    expect(maskBounds("not-a-cut")).toBeUndefined();
  });
});

describe("bakeUv", () => {
  // the vertex shader reconstructs plate uv as (uv - 0.5) / fit + 0.5; the
  // baked attribute must invert that exactly, for the subrect the plane covers
  const FIT = 0.74;
  const shader = (x: number) => (x - 0.5) / FIT + 0.5;

  it("bakes a plane corner to the texture-space corner of its subrect", () => {
    const b: [number, number, number, number] = [0.2, 0.1, 0.6, 0.5];
    // top-left vertex of a PlaneGeometry carries uv (0, 1)
    const tl = bakeUv(0, 1, b, FIT);
    expect(shader(tl[0])).toBeCloseTo(0.2, 9);
    expect(shader(tl[1])).toBeCloseTo(1 - 0.1, 9); // image v0 is the top edge
    const br = bakeUv(1, 0, b, FIT);
    expect(shader(br[0])).toBeCloseTo(0.6, 9);
    expect(shader(br[1])).toBeCloseTo(1 - 0.5, 9);
  });

  it("is linear in between", () => {
    const b: [number, number, number, number] = [0, 0, 1, 1];
    const mid = bakeUv(0.5, 0.5, b, FIT);
    expect(shader(mid[0])).toBeCloseTo(0.5, 9);
    expect(shader(mid[1])).toBeCloseTo(0.5, 9);
  });
});
