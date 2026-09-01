import { describe, expect, it, vi } from "vitest";

import { INTRO_PLAYED_KEY, markIntroPlayed, readPolicyInputs, shouldPlayIntro } from "./introPolicy";

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
}

function throwingStorage(): Storage {
  const deny = () => {
    throw new DOMException("denied", "SecurityError");
  };
  return { getItem: deny, setItem: deny, removeItem: deny, clear: deny, key: deny, length: 0 };
}

const motion = (matches: boolean) => (() => ({ matches })) as unknown as typeof window.matchMedia;

describe("shouldPlayIntro", () => {
  it("plays on a fresh session", () => {
    expect(shouldPlayIntro({ playedThisSession: false, reducedMotion: false })).toBe(true);
  });

  it("does not replay in the same session", () => {
    expect(shouldPlayIntro({ playedThisSession: true, reducedMotion: false })).toBe(false);
  });

  it("never plays with reduced motion", () => {
    expect(shouldPlayIntro({ playedThisSession: false, reducedMotion: true })).toBe(false);
  });
});

describe("readPolicyInputs", () => {
  it("reads a fresh session with no flag and full motion", () => {
    expect(readPolicyInputs(memoryStorage(), motion(false))).toEqual({ playedThisSession: false, reducedMotion: false });
  });

  it("reads the session flag once the intro has been marked played", () => {
    const storage = memoryStorage();
    markIntroPlayed(storage);
    expect(storage.getItem(INTRO_PLAYED_KEY)).not.toBeNull();
    expect(readPolicyInputs(storage, motion(false)).playedThisSession).toBe(true);
  });

  it("reads the reduced-motion preference", () => {
    const matchMedia = vi.fn(motion(true));
    expect(readPolicyInputs(memoryStorage(), matchMedia).reducedMotion).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
  });

  it("storage that throws counts as fresh", () => {
    expect(readPolicyInputs(throwingStorage(), motion(false)).playedThisSession).toBe(false);
    expect(() => markIntroPlayed(throwingStorage())).not.toThrow();
  });

  it("no storage at all counts as fresh", () => {
    expect(readPolicyInputs(undefined, motion(false)).playedThisSession).toBe(false);
    expect(() => markIntroPlayed(undefined)).not.toThrow();
  });
});
