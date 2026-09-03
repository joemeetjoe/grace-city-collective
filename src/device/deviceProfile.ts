import { detectWebgl, shouldUseStaticFallback } from "./fallback";
import { readSaveData, readTierInputs, tierFor, type Tier } from "./tier";
import { TIER_NARROW_WIDTH } from "./tierPolicy";

export type DeviceProfile = {
  fallback: boolean;
  tier: Tier;
};

/** the device's capability verdicts, read once per mount (app/initApp.ts) */
export function readDeviceProfile(reducedMotion: boolean): DeviceProfile {
  // the still poster stands in for the scene: no WebGL, reduced motion, or Save-Data
  const fallback = shouldUseStaticFallback({
    webgl: detectWebgl(),
    reducedMotion,
    saveData: readSaveData(),
  });
  return { fallback, tier: readTier() };
}

/** the media query that flips at the tier's width line (tierPolicy.ts): matches while the viewport is narrower */
export const TIER_NARROW_QUERY = `(max-width: ${TIER_NARROW_WIDTH - 0.02}px)`;

/** the tier the device reads as right now (tier.ts): the mount's, then the live fact `subscribeTier` reports on */
export function readTier(win: Window = window, nav: Navigator = navigator): Tier {
  return tierFor(readTierInputs(win, nav));
}

/**
 * The live half of the device profile: `onChange` is told whenever a tier
 * input the browser reports on has moved — the viewport crossing the tier's
 * width line, or the display's density (a window dragged to another screen,
 * a zoom) — so a subscriber can `readTier` again. Save-Data is read fresh at
 * each report; WebGL never changes. The density query matches the current
 * ratio and so fires as it stops matching; it is re-armed at the new one. A
 * window without matchMedia (very old engines) is never told. The returned
 * function stops listening.
 */
export function subscribeTier(onChange: () => void, win: Window = window): () => void {
  if (!win.matchMedia) return () => {};
  const width = win.matchMedia(TIER_NARROW_QUERY);
  width.addEventListener("change", onChange);
  const onDensity = () => {
    density.removeEventListener("change", onDensity);
    density = armDensity();
    onChange();
  };
  const armDensity = () => {
    const mq = win.matchMedia(`(resolution: ${win.devicePixelRatio || 1}dppx)`);
    mq.addEventListener("change", onDensity);
    return mq;
  };
  let density = armDensity();
  return () => {
    width.removeEventListener("change", onChange);
    density.removeEventListener("change", onDensity);
  };
}
