import type { SectionId } from "@/content/site";
import { readDeviceProfile } from "@/device/deviceProfile";
import { readPolicyInputs, shouldPlayIntro } from "@/features/intro/introPolicy";
import { useAppStore, type AppProfile } from "@/state/appStore";
import { seam } from "@/state/seam";

/** what a mount decides once: whether the splash plays, and the device's verdicts */
function readAppProfile(): AppProfile {
  // once per session, and never under reduced motion
  const policy = readPolicyInputs();
  const { fallback, tier } = readDeviceProfile(policy.reducedMotion);
  return { intro: shouldPlayIntro(policy), reducedMotion: policy.reducedMotion, fallback, tier };
}

/**
 * The store's state for this mount, decided before the tree's first read:
 * App calls it from a lazy `useState` initialiser, so it runs once per mount
 * (twice under StrictMode, to the same answer) and no subscriber exists yet
 * to be told. `firstId` is the section the page opens on.
 */
export function initApp(firstId: SectionId | null): void {
  useAppStore.getState().init({ ...readAppProfile(), activeId: firstId });
  // the tooling's window seam is up from here, smoother or none (transfer.mjs reads the intro off it)
  seam();
}
