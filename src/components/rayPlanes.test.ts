import { describe, expect, it } from "vitest";

import {
  RAY_FAN_DEG,
  RAY_FAR_Z,
  RAY_NEAR_Z,
  platePoint,
  projectToPlane,
  rayIntensity,
  rayRenderOrder,
  raySpecs,
} from "./rayPlanes";

describe("raySpecs", () => {
  it("returns exactly count specs", () => {
    expect(raySpecs(1)).toHaveLength(1);
    expect(raySpecs(2)).toHaveLength(2);
    expect(raySpecs(4)).toHaveLength(4);
    expect(raySpecs(5)).toHaveLength(5);
    expect(raySpecs(0)).toHaveLength(0);
  });

  it("rests every ray strictly between the dove and the crowd, each on its own plane", () => {
    for (const count of [2, 3, 4, 5]) {
      const zs = raySpecs(count).map((r) => r.z);
      for (const z of zs) {
        expect(z).toBeGreaterThan(RAY_FAR_Z);
        expect(z).toBeLessThan(RAY_NEAR_Z);
      }
      expect(new Set(zs).size).toBe(count);
    }
  });

  it("fans the rays out from the dove, symmetric about vertical and within the fan", () => {
    for (const count of [2, 3, 4, 5]) {
      const specs = raySpecs(count);
      const angles = specs.map((r) => r.angle);
      const widths = specs.map((r) => r.width);
      expect(new Set(angles).size).toBe(count);
      expect(new Set(widths).size).toBe(count);
      for (const a of angles) expect(Math.abs(a)).toBeLessThanOrEqual(RAY_FAN_DEG);
      // symmetric: the fan balances around the dove's vertical
      expect(angles.reduce((s, a) => s + a, 0)).toBeCloseTo(0, 6);
      for (const w of widths) expect(w).toBeGreaterThan(0);
    }
  });

  it("is deterministic for the same count and seed, and differs by seed", () => {
    expect(raySpecs(4)).toEqual(raySpecs(4));
    expect(raySpecs(4, 3)).toEqual(raySpecs(4, 3));
    expect(raySpecs(4, 3)).not.toEqual(raySpecs(4, 4));
  });
});

describe("rayIntensity", () => {
  it("is monotonic and clamps outside the scene", () => {
    let prev = -Infinity;
    for (let p = 0; p <= 1; p += 0.05) {
      const v = rayIntensity(p);
      expect(v).toBeGreaterThan(prev);
      prev = v;
    }
    expect(rayIntensity(-1)).toBeCloseTo(0.3, 6);
    expect(rayIntensity(2)).toBeCloseTo(1.25, 6);
  });
});

describe("projectToPlane", () => {
  const plate = { w: 16, h: 19.68 };
  const baseZ = 12.4;
  const dove = platePoint(0.5, 0.967, -4.8, baseZ, plate);

  it("lands a plate point on the same plate uv of any plane from the registration camera", () => {
    const cam = { x: 0, y: 0, z: baseZ };
    for (const planeZ of [-2.87, -1.5, 0, 2.3]) {
      const [u, v] = projectToPlane(cam, dove, planeZ, baseZ, plate);
      expect(u).toBeCloseTo(0.5, 9);
      expect(v).toBeCloseTo(0.967, 9);
    }
  });

  it("pins the apex to the dove's screen position from a displaced camera", () => {
    // the Visit framing: the camera high and close, the dove at z -4.8
    const cam = { x: 0, y: 11.22, z: 6.3 };
    const planeZ = -2.87;
    const [u, v] = projectToPlane(cam, dove, planeZ, baseZ, plate);
    const p = platePoint(u, v, planeZ, baseZ, plate);
    // the re-projected point and the dove subtend the same screen ray
    expect((p.y - cam.y) / (cam.z - p.z)).toBeCloseTo((dove.y - cam.y) / (cam.z - dove.z), 9);
    expect((p.x - cam.x) / (cam.z - p.z)).toBeCloseTo((dove.x - cam.x) / (cam.z - dove.z), 9);
    // which is above where the dove sits on its own plate
    expect(v).toBeGreaterThan(0.967);
  });
});

describe("rayRenderOrder", () => {
  // layers sort by z ascending and draw at renderOrder i + 1
  const layerZ = [-3.0, -2.8, -2.0, -1.7, -0.9, 1.5];

  it("slots a ray between the layers on either side of its z", () => {
    expect(rayRenderOrder(layerZ, -1.8)).toBe(3.5);
    expect(rayRenderOrder(layerZ, -2.9)).toBe(1.5);
    expect(rayRenderOrder(layerZ, -1.0)).toBe(4.5);
  });

  it("draws after every layer when nothing sits in front of it", () => {
    expect(rayRenderOrder(layerZ, 2)).toBe(6.5);
  });
});
