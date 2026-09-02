import { afterEach, describe, expect, it, vi } from "vitest";

import { REDUCED_MOTION_QUERY } from "@/device/reducedMotion";
import { TIERS } from "@/device/tier";
import { REST_STATE, useAppStore } from "./appStore";
import { initialReducedMotion, syncReducedMotion } from "./syncReducedMotion";

/** the window's media queries, each with a live `matches` the test sets, fired by hand */
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
  useAppStore.setState(REST_STATE);
});

describe("initialReducedMotion", () => {
  it("reads the preference off the media query, and a window without matchMedia as full motion", () => {
    const mq = stubMatchMedia();
    expect(initialReducedMotion()).toBe(false);
    mq.set(REDUCED_MOTION_QUERY, true);
    expect(initialReducedMotion()).toBe(true);
    vi.stubGlobal("matchMedia", undefined);
    expect(initialReducedMotion()).toBe(false);
  });
});

describe("syncReducedMotion", () => {
  it("follows the media query's change events into the store, until stopped", () => {
    const mq = stubMatchMedia();
    useAppStore.getState().init({ intro: false, reducedMotion: false, tier: TIERS.desktop, fallback: false });
    const stop = syncReducedMotion();
    expect(mq.listeners(REDUCED_MOTION_QUERY)).toBe(1);
    expect(useAppStore.getState().reducedMotion).toBe(false);

    mq.set(REDUCED_MOTION_QUERY, true);
    expect(useAppStore.getState().reducedMotion).toBe(true);
    mq.set(REDUCED_MOTION_QUERY, false);
    expect(useAppStore.getState().reducedMotion).toBe(false);

    stop();
    expect(mq.listeners(REDUCED_MOTION_QUERY)).toBe(0);
    mq.set(REDUCED_MOTION_QUERY, true);
    expect(useAppStore.getState().reducedMotion).toBe(false);
  });

  it("a flip to reduced motion during the intro brings the splash down through the store", () => {
    const mq = stubMatchMedia();
    useAppStore.getState().init({ intro: true, reducedMotion: false, tier: TIERS.desktop, fallback: false });
    const stop = syncReducedMotion();
    mq.set(REDUCED_MOTION_QUERY, true);
    expect(useAppStore.getState()).toMatchObject({ reducedMotion: true, intro: false, introPlayed: false, fallback: false });
    stop();
  });

  it("is a no-op on a window without matchMedia", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(() => syncReducedMotion()()).not.toThrow();
  });
});
