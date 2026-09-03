import { describe, expect, it } from "vitest";

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
    expect(readPolicyInputs(false, memoryStorage())).toEqual({ playedThisSession: false, reducedMotion: false });
  });

  it("reads the session flag once the intro has been marked played", () => {
    const storage = memoryStorage();
    markIntroPlayed(storage);
    expect(storage.getItem(INTRO_PLAYED_KEY)).not.toBeNull();
    expect(readPolicyInputs(false, storage).playedThisSession).toBe(true);
  });

  it("carries the reduced-motion preference it is given: the media query is read elsewhere (state/syncReducedMotion.ts)", () => {
    expect(readPolicyInputs(true, memoryStorage()).reducedMotion).toBe(true);
  });

  it("storage that throws counts as fresh", () => {
    expect(readPolicyInputs(false, throwingStorage()).playedThisSession).toBe(false);
    expect(() => markIntroPlayed(throwingStorage())).not.toThrow();
  });

  it("no storage at all counts as fresh", () => {
    expect(readPolicyInputs(false, undefined).playedThisSession).toBe(false);
    expect(() => markIntroPlayed(undefined)).not.toThrow();
  });
});
