import { REDUCED_MOTION_QUERY } from "@/device/reducedMotion";
import { useAppStore } from "./appStore";

/**
 * The one runtime reader of `prefers-reduced-motion` (#132): the query's
 * string is device/reducedMotion.ts's, and every call to `matchMedia` with
 * it is here — the mount's initial read, and the subscription that keeps
 * the store's `reducedMotion` live after it. The build-time head scripts
 * (features/intro/staticSplash.ts, device/enginePreload.ts) carry the query
 * as text for the browser to run before the bundle can; the CSS follows the
 * media query natively (`motion-safe:`, index.css). src/test/reducedMotion.scan.test.ts
 * holds the line.
 */

/**
 * The preference as the device reports it now: what a mount decides its
 * profile over (app/initApp.ts) and the poster's inputs read (device/fallback.ts).
 * A window without matchMedia (very old engines) reads as full motion.
 */
export function initialReducedMotion(): boolean {
  return window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false;
}

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
  if (!window.matchMedia) return () => {};
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  const onChange = () => useAppStore.getState().setReducedMotion(mq.matches);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
