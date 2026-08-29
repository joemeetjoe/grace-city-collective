import { describe, expect, it } from "vitest";

import { idleWheel, stepWheel, WHEEL_REST_MS, wheelPixels, type WheelGesture } from "./wheelGesture";

/** feed a run of deltas 16 ms apart from `g`: which ones began a gesture, and the end state */
function feed(g: WheelGesture, deltas: number[], from = 0): { began: number[]; g: WheelGesture } {
  const began: number[] = [];
  deltas.forEach((d, i) => {
    const step = stepWheel(g, d, from + i * 16);
    if (step.began) began.push(i);
    g = step.g;
  });
  return { began, g };
}

/** a trackpad swipe: fingers accelerating, then a long momentum tail down to a pixel a frame */
const swipe = (dir: number, tail = 40) => [
  ...[2, 5, 12, 30, 60].map((d) => d * dir),
  ...Array.from({ length: tail }, (_, i) => Math.max(1, Math.round(60 * 0.85 ** (i + 1))) * dir),
];

describe("stepWheel", () => {
  it("the first event after a rest begins a gesture", () => {
    expect(stepWheel(idleWheel, 100, 0).began).toBe(true);
    const { g } = stepWheel(idleWheel, 100, 0);
    expect(stepWheel(g, 100, WHEEL_REST_MS + 1).began).toBe(true);
    expect(stepWheel(g, 100, WHEEL_REST_MS - 50).began).toBe(false);
  });

  it("a swipe is one gesture, tail included", () => {
    expect(feed(idleWheel, swipe(1)).began).toEqual([0]);
  });

  it("a second swipe growing out of the first's tail is a new gesture", () => {
    const first = feed(idleWheel, swipe(1));
    const second = feed(first.g, swipe(1), 45 * 16);
    expect(second.began).toEqual([2]); // 12 px: past the floor, and growing
  });

  it("a reversal is a new gesture at once, even inside the tail", () => {
    const first = feed(idleWheel, swipe(1));
    const back = feed(first.g, swipe(-1), 45 * 16);
    expect(back.began).toEqual([0]);
  });

  it("a mouse spin is one gesture; spaced notches are one each", () => {
    expect(feed(idleWheel, [100, 100, 100, 100]).began).toEqual([0]);
    let g = idleWheel;
    const began: number[] = [];
    [0, 400, 800].forEach((t, i) => {
      const step = stepWheel(g, 100, t);
      if (step.began) began.push(i);
      g = step.g;
    });
    expect(began).toEqual([0, 1, 2]);
  });

  it("a wobble while the fingers are still moving is not a new gesture", () => {
    expect(feed(idleWheel, [10, 30, 25, 40, 60, 50, 40]).began).toEqual([0]);
  });

  it("a stall inside a tail (a busy frame) is not a rest, even delivering a coalesced spike", () => {
    const { g } = feed(idleWheel, [60, 30, 20, 10]);
    const after = 4 * 16 + WHEEL_REST_MS + 100;
    expect(stepWheel(g, 8, after).began).toBe(false);
    expect(stepWheel(g, 20, after).began).toBe(false);
    // but a swipe that begins after such a stall grows, and counts
    const stalled = stepWheel(g, 8, after).g;
    expect(feed(stalled, [2, 5, 12, 30], after + 16).began).toEqual([2]);
  });

  it("while the page is busy turning, only a reversal begins a gesture", () => {
    let g = idleWheel;
    const began: boolean[] = [];
    [[100, 0], [100, 400], [-100, 416], [-2, 800], [-5, 816], [-12, 832], [-30, 848]].forEach(([d, t]) => {
      const step = stepWheel(g, d, t, true);
      began.push(step.began);
      g = step.g;
    });
    expect(began).toEqual([false, false, true, false, false, false, false]);
  });

  it("a notch after a swipe's tail has rested is a gesture; a small delta there is not", () => {
    const { g } = feed(idleWheel, swipe(1));
    expect(stepWheel(g, 100, 45 * 16 + WHEEL_REST_MS + 1).began).toBe(true);
    expect(stepWheel(g, 6, 45 * 16 + WHEEL_REST_MS + 1).began).toBe(false);
  });

  it("jitter in a tail below the floor does not start a gesture", () => {
    const { g } = feed(idleWheel, [60, 30, 6, 3]);
    expect(stepWheel(g, 6, 4 * 16).began).toBe(false);
  });

  it("a lone spike in a tail — two events coalesced on a busy frame — is not a gesture", () => {
    const tail = [60, 40, 20, 10, 6, 6, 5];
    expect(feed(idleWheel, [...tail, 10, 4, 4]).began).toEqual([0]);
    expect(feed(idleWheel, [...tail, 12, 3]).began).toEqual([0]);
  });

  it("a gentle swipe out of a tail still counts once it has risen twice running", () => {
    const { g } = feed(idleWheel, [60, 40, 20, 10, 6, 5, 4, 3]);
    expect(feed(g, [4, 6, 9, 14, 20], 8 * 16).began).toEqual([3]); // 14: two rises, past the floor
  });
});

describe("wheelPixels", () => {
  it("scales lines and pages to pixels, leaving pixels alone", () => {
    expect(wheelPixels({ deltaY: 3, deltaMode: 1 }, 20, 900)).toBe(60);
    expect(wheelPixels({ deltaY: 1, deltaMode: 2 }, 20, 900)).toBe(900);
    expect(wheelPixels({ deltaY: 42, deltaMode: 0 }, 20, 900)).toBe(42);
  });
});
