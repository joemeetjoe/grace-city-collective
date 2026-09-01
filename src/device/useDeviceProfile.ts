import { useState } from "react";

import { detectWebgl, shouldUseStaticFallback } from "./fallback";
import { readSaveData, readTierInputs, tierFor, type Tier } from "./tier";

export type DeviceProfile = {
  fallback: boolean;
  tier: Tier;
};

/** the device's capability verdicts, decided once per mount */
export function useDeviceProfile(reducedMotion: boolean): DeviceProfile {
  // the still poster stands in for the scene: no WebGL, reduced motion, or Save-Data
  const [fallback] = useState(() =>
    shouldUseStaticFallback({
      webgl: detectWebgl(),
      reducedMotion,
      saveData: readSaveData(),
    }),
  );
  const [tier] = useState(() => tierFor(readTierInputs()));
  return { fallback, tier };
}
