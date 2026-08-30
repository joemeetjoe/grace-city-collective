import { describe, expect, it } from "vitest";

import { PORTRAIT_BAND_FACTOR, portraitFactor, widenBand, type Band } from "./portraitBand";

describe("portraitFactor", () => {
  it("is 1 on every landscape and square frame, so the desktop framing cannot move", () => {
    expect(portraitFactor(16 / 9)).toBe(1);
    expect(portraitFactor(1440 / 900)).toBe(1);
    expect(portraitFactor(1)).toBe(1);
  });

  it("is the portrait factor on a portrait frame", () => {
    expect(portraitFactor(390 / 844)).toBe(PORTRAIT_BAND_FACTOR);
    expect(portraitFactor(768 / 1024)).toBe(PORTRAIT_BAND_FACTOR);
    expect(portraitFactor(0.5, 1.5)).toBe(1.5);
  });

  it("widens rather than tightens", () => {
    expect(PORTRAIT_BAND_FACTOR).toBeGreaterThan(1);
  });
});

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
