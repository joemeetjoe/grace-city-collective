import { describe, expect, it } from "vitest";

import metrics from "./fontMetrics.json";
import { FONT_FALLBACKS, FONT_FALLBACK_CSS, fallbackOverrides, fontFaceCss, fontFallbackCss, round4 } from "./fontFallback";
import type { FontFallback } from "./fontFallback";

// a made-up pair: the web face's letters average half an em, the local's
// 0.4 em, so the local must be set 25% larger; its overrides are the web
// font's 0.9 / 0.25 / 0.05 em, each divided by that 1.25
const fixture: FontFallback = {
  fallbackFamily: "Fixture Fallback",
  localFamily: "Local Face",
  web: { unitsPerEm: 1000, ascent: 900, descent: -250, lineGap: 50, xWidthAvg: 500 },
  local: { unitsPerEm: 2000, xWidthAvg: 800 },
  overrides: { sizeAdjust: 1.25, ascent: 0.72, descent: 0.2, lineGap: 0.04 },
};

describe("fallbackOverrides", () => {
  it("sets size-adjust from the width ratio and divides the web font's metrics by it", () => {
    expect(fallbackOverrides(fixture.web, fixture.local)).toEqual(fixture.overrides);
  });

  it("rounds to four decimals, half up", () => {
    expect(round4(0.12344999)).toBe(0.1234);
    expect(round4(0.12345)).toBe(0.1235);
    expect(round4(1)).toBe(1);
  });
});

describe("fontFaceCss", () => {
  it("writes one minified @font-face over the local face with the four descriptors as percentages", () => {
    expect(fontFaceCss(fixture)).toBe(
      '@font-face{font-family:"Fixture Fallback";src:local("Local Face");' +
        "size-adjust:125.00%;ascent-override:72.00%;descent-override:20.00%;line-gap-override:4.00%}",
    );
  });

  it("joins the faces in order", () => {
    const second = { ...fixture, fallbackFamily: "Second Fallback" };
    expect(fontFallbackCss([fixture, second])).toBe(`${fontFaceCss(fixture)}${fontFaceCss(second)}`);
  });
});

describe("the checked-in metrics (src/theme/fontMetrics.json)", () => {
  it("carry overrides equal to what fallbackOverrides computes from their own metrics", () => {
    for (const face of [metrics.sans, metrics.serif]) {
      expect(face.overrides).toEqual(fallbackOverrides(face.web, face.local));
    }
  });

  it("name the two faces the site sets, over Arial and Georgia", () => {
    expect(metrics.sans.family).toBe("Geist Variable");
    expect(metrics.sans.localFamily).toBe("Arial");
    expect(metrics.serif.family).toBe("Cormorant Garamond");
    expect(metrics.serif.localFamily).toBe("Georgia");
  });

  it("are what FONT_FALLBACK_CSS is generated from, sans then serif", () => {
    expect(FONT_FALLBACKS).toEqual([metrics.sans, metrics.serif]);
    expect(FONT_FALLBACK_CSS).toBe(fontFallbackCss(FONT_FALLBACKS));
    expect(FONT_FALLBACK_CSS).toContain('@font-face{font-family:"Geist Fallback";src:local("Arial");');
    expect(FONT_FALLBACK_CSS).toContain('@font-face{font-family:"Cormorant Garamond Fallback";src:local("Georgia");');
  });
});
