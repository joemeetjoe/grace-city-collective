/**
 * The scene frame's height tracks the visible viewport (100dvh), but
 * browsers re-resolve dvh in coarse steps while a phone's URL bar shows or
 * hides, so the trim's bottom edge lurches instead of gliding with the bar
 * — and a CSS transition cannot smooth it, because a viewport unit's
 * re-resolution never starts one. Measuring the same height in px and
 * setting it inline does start one: below lg the frame takes its height
 * from here and transitions between the steps. At lg and up there is no
 * URL bar, dvh and lvh agree, and the dvh class stands alone.
 */

import { useSyncExternalStore } from "react";

/** The layout viewport height in px — what 100dvh resolves to; null without a window. */
export function readViewportHeight(
  win: Window | null = typeof window === "undefined" ? null : window,
): number | null {
  return win ? win.innerHeight : null;
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

const none = () => null;
const noSubscribe = () => () => {};

/**
 * The viewport height in px, live across resizes — or null while disabled,
 * where the caller's dvh class stands on its own.
 */
export function useViewportHeight(enabled: boolean): number | null {
  return useSyncExternalStore(
    enabled ? subscribe : noSubscribe,
    enabled ? readViewportHeight : none,
    none,
  );
}
