import { describe, expect, it, vi } from "vitest";

import { detectWebgl, readFallbackInputs, shouldUseStaticFallback } from "./fallback";
import { REDUCED_MOTION_QUERY } from "./reducedMotion";

const live = { webgl: true, reducedMotion: false, saveData: false };

describe("shouldUseStaticFallback", () => {
  it("is off when WebGL is up, motion is welcome and data is unmetered", () => {
    expect(shouldUseStaticFallback(live)).toBe(false);
  });
  it("is on without WebGL", () => {
    expect(shouldUseStaticFallback({ ...live, webgl: false })).toBe(true);
  });
  it("is on under reduced motion", () => {
    expect(shouldUseStaticFallback({ ...live, reducedMotion: true })).toBe(true);
  });
  it("is on under Save-Data", () => {
    expect(shouldUseStaticFallback({ ...live, saveData: true })).toBe(true);
  });
});

function docWithContext(get: (kind: string) => unknown) {
  return { createElement: () => ({ getContext: get }) } as unknown as Document;
}

describe("detectWebgl", () => {
  it("is true when a webgl2 or webgl context can be created", () => {
    expect(detectWebgl(docWithContext((k) => (k === "webgl2" ? {} : null)))).toBe(true);
    expect(detectWebgl(docWithContext((k) => (k === "webgl" ? {} : null)))).toBe(true);
  });
  it("is false when neither context comes back", () => {
    expect(detectWebgl(docWithContext(() => null))).toBe(false);
  });
  it("is false when getContext throws (jsdom, blocked GPU)", () => {
    expect(
      detectWebgl(
        docWithContext(() => {
          throw new Error("not implemented");
        }),
      ),
    ).toBe(false);
  });
});

describe("readFallbackInputs", () => {
  it("gathers the three signals from the browser", () => {
    const nav = { connection: { saveData: true } } as unknown as Navigator;
    const doc = docWithContext(() => null);
    expect(readFallbackInputs({ doc, reducedMotion: true, nav })).toEqual({ webgl: false, reducedMotion: true, saveData: true });
  });

  it("reads the preference through the one runtime reader when none is given (state/syncReducedMotion.ts)", () => {
    const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) => ({ matches: query === REDUCED_MOTION_QUERY, media: query }) as MediaQueryList,
    );
    const nav = { connection: { saveData: false } } as unknown as Navigator;
    expect(readFallbackInputs({ doc: docWithContext(() => null), nav }).reducedMotion).toBe(true);
    expect(matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
    vi.restoreAllMocks();
  });
});
