import { afterEach, describe, expect, it, vi } from "vitest";

import { TIER_NARROW_QUERY } from "@/device/deviceProfile";
import { TIERS } from "@/device/tier";
import { REST_STATE, useAppStore } from "./appStore";
import { syncTier } from "./syncTier";

/** the window's media queries, fired by hand */
function stubMatchMedia() {
  const lists = new Map<string, Set<() => void>>();
  vi.spyOn(window, "matchMedia").mockImplementation((query: string) => {
    const listeners = lists.get(query) ?? new Set<() => void>();
    lists.set(query, listeners);
    return {
      media: query,
      matches: false,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
    } as unknown as MediaQueryList;
  });
  return (query: string) => {
    for (const fn of [...(lists.get(query) ?? [])]) fn();
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useAppStore.setState(REST_STATE);
});

describe("syncTier", () => {
  it("re-reads the device's tier into the store as the viewport crosses the width line, until stopped", () => {
    const fire = stubMatchMedia();
    vi.stubGlobal("innerWidth", 1600);
    vi.stubGlobal("devicePixelRatio", 2);
    useAppStore.getState().init({ intro: false, reducedMotion: false, tier: TIERS.desktop, fallback: false });
    const stop = syncTier();
    expect(useAppStore.getState().tier).toBe(TIERS.desktop);

    vi.stubGlobal("innerWidth", 800);
    fire(TIER_NARROW_QUERY);
    expect(useAppStore.getState().tier).toBe(TIERS.mobile);

    vi.stubGlobal("innerWidth", 1600);
    fire(TIER_NARROW_QUERY);
    expect(useAppStore.getState().tier).toBe(TIERS.desktop);

    stop();
    vi.stubGlobal("innerWidth", 800);
    fire(TIER_NARROW_QUERY);
    expect(useAppStore.getState().tier).toBe(TIERS.desktop);
  });
});
