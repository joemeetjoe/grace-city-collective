import { describe, expect, it } from "vitest";

import { POSTER_FORMATS, POSTER_RUNGS, posterSource } from "./posterLadder";

describe("POSTER_RUNGS", () => {
  it("is the ladder cut from the 2048 plate, ascending, so a srcset lists it in order", () => {
    expect(POSTER_RUNGS).toEqual([640, 960, 1280, 1600, 2048]);
    expect(POSTER_FORMATS).toEqual(["avif", "webp"]);
  });
});

describe("posterSource", () => {
  it.each([
    // viewport width (CSS px), dpr, Save-Data → rung
    [390, 3, false, 1280, "a 390 phone at 3x needs 1170 px: the 1280 rung, never the 2048"],
    [390, 2, false, 960, "the same phone at 2x needs 780 px: 960"],
    [390, 1.5, false, 640, "the mobile transfer profile (390 at 1.5x) needs 585 px: the smallest rung"],
    [430, 3, false, 1600, "a 430 phone at 3x needs 1290 px: just over 1280, so 1600"],
    [1024, 1, false, 1280, "a 1x tablet at 1024 takes 1280"],
    [1600, 2, false, 2048, "the desktop transfer profile (1600 at 2x) needs 3200 px: the largest rung caps it"],
    [3840, 1, false, 2048, "a 4k display at 1x still caps at the plate width"],
    [640, 1, false, 640, "an exact fit takes its own rung"],
    [641, 1, false, 960, "one pixel over a rung takes the next"],
    [1600, 2, true, 640, "Save-Data takes the smallest rung whatever the viewport and dpr"],
    [390, 3, true, 640, "Save-Data on a 3x phone too"],
  ])("width %i at dpr %s, saveData %s picks %i (%s)", (width, dpr, saveData, rung) => {
    expect(posterSource({ width, dpr, saveData })).toEqual({ formats: ["avif", "webp"], rung });
  });

  it("works over any ascending ladder, capping at its largest rung", () => {
    expect(posterSource({ width: 500, dpr: 1, saveData: false }, [320, 800]).rung).toBe(800);
    expect(posterSource({ width: 900, dpr: 1, saveData: false }, [320, 800]).rung).toBe(800);
    expect(posterSource({ width: 900, dpr: 1, saveData: true }, [320, 800]).rung).toBe(320);
  });
});
