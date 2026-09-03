import { subscribeReducedMotion } from "@/device/motionPreference";
import { useAppStore } from "./appStore";

/**
 * The store's side of `prefers-reduced-motion` (#132): the browser reads
 * are the device layer's (device/motionPreference.ts), and this is the one
 * place they reach the store — the pattern of syncTier.ts. The build-time head scripts
 * (features/intro/staticSplash.ts, device/enginePreload.ts) carry the query
 * as text for the browser to run before the bundle can; the CSS follows the
 * media query natively (`motion-safe:`, index.css). src/test/reducedMotion.scan.test.ts
 * holds the line.
 */

/**
 * Keep the store's `reducedMotion` the visitor's live preference while
 * mounted (the pattern of syncTier.ts): the OS setting toggled mid-session
 * reaches every consumer through the store — the smoother gives way to
 * native scroll (scroll/useSmoothScroll.ts), the ornaments rest
 * (features/stops/useStopPanel.ts), the engine's idle drift stops
 * (engine/PentecostParallax.tsx), a splash still up comes down and the page
 * opens from ink (appStore.setReducedMotion, features/intro/useIntroReveals.ts).
 * What the mount decided stays decided: the poster stands in only where
 * init put it (`fallback`), and a scene already running keeps running.
 * Returns the function that stops syncing; App runs it as an effect.
 */
export function syncReducedMotion(): () => void {
  return subscribeReducedMotion((reduced) => useAppStore.getState().setReducedMotion(reduced));
}
