import { afterEach, describe, expect, it, vi } from "vitest";

import { REDUCED_MOTION_QUERY } from "./reducedMotion";
import { readReducedMotion, subscribeReducedMotion } from "./motionPreference";

/** the window's media queries, with a live `matches` the test sets, fired by hand */
function stubMatchMedia() {
  const matching = new Set<string>();
  const lists = new Map<string, Set<() => void>>();
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
    const listeners = lists.get(query) ?? new Set<() => void>();
    lists.set(query, listeners);
    return {
      media: query,
      get matches() {
        return matching.has(query);
      },
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    } as unknown as MediaQueryList;
  });
  return {
    set(query: string, matches: boolean) {
      if (matches) matching.add(query);
      else matching.delete(query);
      for (const fn of [...(lists.get(query) ?? [])]) fn();
    },
    listeners: (query: string) => lists.get(query)?.size ?? 0,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("readReducedMotion", () => {
  it("reads the preference off the media query, and a window without matchMedia as full motion", () => {
    const mq = stubMatchMedia();
    expect(readReducedMotion()).toBe(false);
    mq.set(REDUCED_MOTION_QUERY, true);
    expect(readReducedMotion()).toBe(true);
    vi.stubGlobal("matchMedia", undefined);
    expect(readReducedMotion()).toBe(false);
  });
});

describe("subscribeReducedMotion", () => {
  it("tells the listener the new value on every change, until it stops", () => {
    const mq = stubMatchMedia();
    const seen: boolean[] = [];
    const stop = subscribeReducedMotion((reduced) => seen.push(reduced));
    mq.set(REDUCED_MOTION_QUERY, true);
    mq.set(REDUCED_MOTION_QUERY, false);
    expect(seen).toEqual([true, false]);
    stop();
    expect(mq.listeners(REDUCED_MOTION_QUERY)).toBe(0);
    mq.set(REDUCED_MOTION_QUERY, true);
    expect(seen).toEqual([true, false]);
  });

  it("is inert in a window without matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(() => subscribeReducedMotion(() => {})()).not.toThrow();
  });
});
