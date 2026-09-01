import { describe, expect, it } from "vitest";

import { SCROLL_DPR, createScrollDpr, movingDprFor } from "./scrollDpr";

const cfg = { sharp: 2, moving: 1.4, enterPxPerS: SCROLL_DPR.enterPxPerS, exitPxPerS: SCROLL_DPR.exitPxPerS };

describe("createScrollDpr", () => {
  it("rests sharp, and stays sharp through slow deliberate scrolling", () => {
    const dpr = createScrollDpr(cfg);
    expect(dpr.forSpeed(0)).toBe(2);
    expect(dpr.forSpeed(100)).toBe(2);
  });

  it("drops while the scroll flies, when motion hides the softness", () => {
    const dpr = createScrollDpr(cfg);
    expect(dpr.forSpeed(2400)).toBe(1.4);
  });

  it("holds through the glide out (hysteresis), then lands the settle frame sharp", () => {
    const dpr = createScrollDpr(cfg);
    dpr.forSpeed(2400);
    // easing out: between the thresholds nothing flaps
    expect(dpr.forSpeed(500)).toBe(1.4);
    expect(dpr.forSpeed(200)).toBe(1.4);
    // settled: this frame renders sharp
    expect(dpr.forSpeed(40)).toBe(2);
  });
});

describe("movingDprFor", () => {
  it("scales the sharp cap down but never below 1", () => {
    expect(movingDprFor(2)).toBeCloseTo(1.4, 9);
    expect(movingDprFor(1.5)).toBeCloseTo(1.05, 9);
    expect(movingDprFor(1)).toBe(1);
  });
});
