import { describe, expect, it } from "vitest";

import { checkPaint, formatPaintTable } from "./paintReport.mjs";

const good = { desktop: { lcpMs: 41, element: "h1", isSplashHeadline: true }, mobile: { lcpMs: 35, element: "h1", isSplashHeadline: true } };

describe("checkPaint", () => {
  it("passes when every profile paints the splash headline inside the ceiling", () => {
    expect(checkPaint(good, { lcpMs: 400 })).toEqual([]);
  });

  it("names the profile whose paint is late, and the one painting something else", () => {
    const late = { ...good, mobile: { lcpMs: 900, element: "h1", isSplashHeadline: true } };
    expect(checkPaint(late, { lcpMs: 400 })).toEqual(["mobile: LCP 900 ms is over the 400 ms ceiling"]);
    const other = { ...good, desktop: { lcpMs: 41, element: "img.poster", isSplashHeadline: false } };
    expect(checkPaint(other, { lcpMs: 400 })).toEqual([
      "desktop: the largest paint is img.poster, not the splash headline",
    ]);
  });

  it("reports a profile that never painted", () => {
    expect(checkPaint({ mobile: { lcpMs: null, element: null, isSplashHeadline: false } }, { lcpMs: 400 })).toEqual([
      "mobile: nothing painted",
    ]);
  });
});

describe("formatPaintTable", () => {
  it("prints a row per profile with the element and the observed paint", () => {
    const text = formatPaintTable(good, { lcpMs: 400 });
    expect(text).toMatch(/desktop\s+41\s+400\s+h1/);
    expect(text).toMatch(/mobile\s+35\s+400\s+h1/);
  });
});
