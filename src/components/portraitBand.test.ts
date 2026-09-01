import { describe, expect, it } from "vitest";

import { widenBand, type Band } from "./portraitBand";

describe("widenBand", () => {
  const hero: Band = [0.185, 0.765];

  it("returns the same band for a factor of 1", () => {
    expect(widenBand(hero, 1)).toBe(hero);
  });

  it("scales the band's height by the factor", () => {
    const [lo, hi] = widenBand(hero, 1.35);
    expect(hi - lo).toBeCloseTo((hero[1] - hero[0]) * 1.35, 12);
  });

  it("keeps the band's centre exactly", () => {
    const [lo, hi] = widenBand(hero, 1.35);
    expect((lo + hi) / 2).toBeCloseTo((hero[0] + hero[1]) / 2, 12);
  });

  it("may reach past the plate — the solve's cover-fit clamp is what caps it", () => {
    const [lo, hi] = widenBand([-0.02, 0.2], 1.35);
    expect(lo).toBeLessThan(-0.02);
    expect(hi).toBeGreaterThan(0.2);
    expect(hi - lo).toBeCloseTo(0.22 * 1.35, 12);
  });
});
