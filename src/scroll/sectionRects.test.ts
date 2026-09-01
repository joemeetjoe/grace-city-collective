import { describe, expect, it } from "vitest";

import { sectionProgressAt, type SectionRect } from "./sectionRects";

// the scene's section stack as measured rects: three full screens
const H = 800;
const rects: SectionRect[] = [
  { top: 0, height: H },
  { top: H, height: H },
  { top: 2 * H, height: H },
];

describe("sectionProgressAt", () => {
  it("is 0 with no sections", () => {
    expect(sectionProgressAt(400, [])).toBe(0);
  });

  it("reads an index plus the fraction through it at the viewport centre", () => {
    expect(sectionProgressAt(0, rects)).toBe(0);
    expect(sectionProgressAt(H / 2, rects)).toBe(0.5);
    expect(sectionProgressAt(H, rects)).toBe(1);
    expect(sectionProgressAt(H + H / 4, rects)).toBe(1.25);
  });

  it("runs the last section past 1, unclamped, so the embers see the scene slide away", () => {
    expect(sectionProgressAt(2.5 * H, rects)).toBe(2.5);
    expect(sectionProgressAt(10 * H, rects)).toBe(3);
  });

  it("never goes below the first section", () => {
    expect(sectionProgressAt(-300, rects)).toBe(0);
  });

  it("lands a gap between sections at the top of the section after it", () => {
    const gapped: SectionRect[] = [
      { top: 0, height: H },
      { top: H + 200, height: H },
    ];
    expect(sectionProgressAt(H + 100, gapped)).toBe(1);
  });
});
