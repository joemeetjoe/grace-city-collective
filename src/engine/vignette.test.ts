import { describe, expect, it } from "vitest";

import { VIGNETTE, VIGNETTE_GLSL, vignetteAlpha, vignetteCss } from "./vignette";

describe("vignetteAlpha", () => {
  it("is clear at the focus and darkest past the ellipse", () => {
    expect(vignetteAlpha(VIGNETTE.at[0], VIGNETTE.at[1])).toBe(0);
    // the focus sits high, so the top corners fall short of the last stop
    // and the bottom corners (where the wordmark lives) reach it
    expect(vignetteAlpha(0, 0)).toBeCloseTo(0.547, 2);
    expect(vignetteAlpha(1, 1)).toBe(VIGNETTE.stops[2][1]);
    expect(vignetteAlpha(-0.5, 1.5)).toBe(VIGNETTE.stops[2][1]);
  });

  it("interpolates linearly between the stops along the ellipse's radius", () => {
    // a point half way to the middle stop along the horizontal radius
    const [cx, cy] = VIGNETTE.at;
    const [d1, a1] = VIGNETTE.stops[1];
    expect(vignetteAlpha(cx + (VIGNETTE.radii[0] * d1) / 2, cy)).toBeCloseTo(a1 / 2);
    // the middle stop itself, straight down
    expect(vignetteAlpha(cx, cy + VIGNETTE.radii[1] * d1)).toBeCloseTo(a1);
  });

  it("is symmetric about the focus", () => {
    const [cx, cy] = VIGNETTE.at;
    expect(vignetteAlpha(cx - 0.3, cy)).toBeCloseTo(vignetteAlpha(cx + 0.3, cy));
    expect(vignetteAlpha(cx, cy - 0.2)).toBeCloseTo(vignetteAlpha(cx, cy + 0.2));
  });
});

describe("vignetteCss", () => {
  it("is the radial gradient the back canvas wears, in the ink", () => {
    expect(vignetteCss()).toBe(
      "radial-gradient(ellipse 80% 65% at 50% 38%, transparent 0%, rgba(20,16,14,0.3) 65%, rgba(20,16,14,0.72) 100%)",
    );
  });
});

describe("VIGNETTE_GLSL", () => {
  it("carries the same focus, radii and stops as the CSS", () => {
    expect(VIGNETTE_GLSL).toContain("vec2(0.5, 0.62)"); // gl y is up: 1 - 0.38
  });
});
