import { detectWebgl, shouldUseStaticFallback } from "./fallback";
import { readSaveData, readTierInputs, tierFor, type Tier } from "./tier";

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
  return { fallback, tier: tierFor(readTierInputs()) };
}
