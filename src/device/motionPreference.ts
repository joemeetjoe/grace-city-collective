/**
 * The visitor's motion preference, read from the browser. The device layer
 * owns the reads — the query's string is reducedMotion.ts's, kept DOM-free
 * for the build-time head scripts — and state/syncReducedMotion.ts is the
 * adapter that puts them in the store, the way deviceProfile.ts's readTier
 * and subscribeTier sit under syncTier.ts.
 */
import { REDUCED_MOTION_QUERY } from "./reducedMotion";

/**
 * The preference as the device reports it now: what a mount decides its
 * profile over (app/initApp.ts) and the poster's inputs read (fallback.ts).
 * A window without matchMedia (very old engines) reads as full motion.
 */
export function readReducedMotion(win: Window = window): boolean {
  return win.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false;
}

/**
 * Call `onChange` whenever the preference changes; returns the function
 * that stops listening. A window without matchMedia is never told.
 */
export function subscribeReducedMotion(onChange: (reduced: boolean) => void, win: Window = window): () => void {
  if (!win.matchMedia) return () => {};
  const mq = win.matchMedia(REDUCED_MOTION_QUERY);
  const listener = () => onChange(mq.matches);
  mq.addEventListener("change", listener);
  return () => mq.removeEventListener("change", listener);
}
