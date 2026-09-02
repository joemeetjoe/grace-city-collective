import { describe, expect, it, vi } from "vitest";

import { readTier, subscribeTier, TIER_NARROW_QUERY } from "./deviceProfile";
import { TIERS } from "./tier";
import { TIER_NARROW_WIDTH } from "./tierPolicy";

/** a window whose media queries the test fires by hand */
function fakeWindow(innerWidth: number, devicePixelRatio: number) {
  const lists = new Map<string, Set<() => void>>();
  const win = {
    innerWidth,
    devicePixelRatio,
    matchMedia: (query: string) => {
      const listeners = lists.get(query) ?? new Set<() => void>();
      lists.set(query, listeners);
      return {
        media: query,
        matches: false,
        addEventListener: (_: "change", fn: () => void) => listeners.add(fn),
        removeEventListener: (_: "change", fn: () => void) => listeners.delete(fn),
      } as unknown as MediaQueryList;
    },
  };
  const fire = (query: string) => {
    for (const fn of [...(lists.get(query) ?? [])]) fn();
  };
  const listening = (query: string) => lists.get(query)?.size ?? 0;
  return { win: win as unknown as Window & typeof win, fire, listening };
}

const nav = {} as Navigator;

describe("readTier", () => {
  it("reads the tier the window's width and density decide (tier.ts)", () => {
    expect(readTier(fakeWindow(1600, 2).win, nav)).toBe(TIERS.desktop);
    expect(readTier(fakeWindow(800, 2).win, nav)).toBe(TIERS.mobile);
    expect(readTier(fakeWindow(1600, 1).win, nav)).toBe(TIERS.mobile);
  });
});

describe("subscribeTier", () => {
  it("names the tier's width line as a query", () => {
    expect(TIER_NARROW_QUERY).toBe(`(max-width: ${TIER_NARROW_WIDTH - 0.02}px)`);
  });

  it("tells of the viewport crossing the width line, and stops when asked", () => {
    const { win, fire, listening } = fakeWindow(1600, 2);
    const onChange = vi.fn();
    const stop = subscribeTier(onChange, win);
    expect(listening(TIER_NARROW_QUERY)).toBe(1);
    fire(TIER_NARROW_QUERY);
    expect(onChange).toHaveBeenCalledTimes(1);
    stop();
    fire(TIER_NARROW_QUERY);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(listening(TIER_NARROW_QUERY)).toBe(0);
  });

  it("tells of the display's density changing, re-armed at the new ratio", () => {
    const { win, fire, listening } = fakeWindow(1600, 2);
    const onChange = vi.fn();
    const stop = subscribeTier(onChange, win);
    expect(listening("(resolution: 2dppx)")).toBe(1);
    win.devicePixelRatio = 1;
    fire("(resolution: 2dppx)");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(listening("(resolution: 2dppx)")).toBe(0);
    expect(listening("(resolution: 1dppx)")).toBe(1);
    stop();
    expect(listening("(resolution: 1dppx)")).toBe(0);
  });

  it("never tells where the window has no matchMedia", () => {
    const stop = subscribeTier(vi.fn(), { innerWidth: 800 } as unknown as Window);
    expect(stop).not.toThrow();
  });
});
