/**
 * The one layout switch the phone/tablet treatment hangs off: the viewport
 * is narrower than Tailwind's `lg`. Below it the scene scrolls natively, the
 * copy sits on the scene, the lockup stacks (#52, #53, #55, #56). It is the
 * breakpoint the sections' classes already key on (`lg:flex-row`, `lg:py-0`,
 * TUCK), so CSS and script agree by construction — and it is deliberately
 * not the asset tier (scene/tier.ts, which also flips on DPR and Save-Data)
 * nor touch detection.
 */

import { useSyncExternalStore } from "react";

import { LG_PX } from "@/theme/breakpoints";

/** the media query for "below lg", the complement of Tailwind's `lg:` variant */
export const BELOW_LG_QUERY = `(max-width: ${LG_PX - 0.02}px)`;

/** Pure: whether a viewport width takes the phone/tablet layout. */
export function belowLg(width: number): boolean {
  return width < LG_PX;
}

/** the current answer from the browser; false wherever there is no window (SSR, tests without jsdom) */
export function readBelowLg(win: Window | undefined = typeof window === "undefined" ? undefined : window): boolean {
  if (!win) return false;
  const mq = win.matchMedia?.(BELOW_LG_QUERY);
  return mq ? mq.matches : belowLg(win.innerWidth);
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(BELOW_LG_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

/** Whether the viewport is below `lg`, live: re-renders when a resize crosses the breakpoint. */
export function useBelowLg(): boolean {
  return useSyncExternalStore(subscribe, readBelowLg, () => false);
}
