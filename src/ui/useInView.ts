import { useMemo, useState } from "react";

import { useWatch } from "./useWatch";
import { createWatch } from "./watch";

/**
 * The band of the viewport a scene stop plays in on a phone, as shares of
 * its height cut off the top and the foot: a stop's panel is "settled on
 * screen" while some part of it stands between a tenth down from the top
 * and a seventh up from the foot. Coming down the page it starts once its
 * top is that far up the viewport — a beat in, not on its first pixel, yet
 * before more than a sliver of empty glass shows — and undoes once it has
 * all but left at the top; coming back up it starts again once it is clear
 * of the foot. Deliberately no share of the *target* (IntersectionObserver's
 * threshold): a panel taller than the band would never reach it.
 */
export const PLAY_BAND = { top: 0.1, bottom: 0.15 } as const;

/**
 * The `rootMargin` that shrinks the viewport to a band: `top` and `bottom`
 * are shares of the viewport's height cut off each edge.
 */
export function bandMargin(top: number, bottom: number): string {
  return `-${Math.round(top * 100)}% 0px -${Math.round(bottom * 100)}% 0px`;
}

/** the play band as a `rootMargin`, for `useInView` */
export const PLAY_MARGIN = bandMargin(PLAY_BAND.top, PLAY_BAND.bottom);

/**
 * What "on screen" means, in one place: an element is on screen while
 * `threshold` of it crosses the viewport shrunk by `rootMargin`. Everything
 * that asks reads it through `useInView`; the two ways of asking are what
 * to report before the observer answers (`initial`) and whether to stop
 * listening at the first yes (`once`).
 */
export type InViewOptions = {
  /**
   * the fraction of the element that must be in the (margined) viewport —
   * or a function of the element, for a fraction that depends on its
   * measured size, resolved as the watch starts (useInViewOnce's cap)
   */
  threshold?: number | ((el: Element) => number);
  /** the viewport's margin, as IntersectionObserver takes it: negative values shrink it to a band */
  rootMargin?: string;
  /**
   * what to report before the observer answers, and for good wherever
   * IntersectionObserver is missing (jsdom, very old engines), nothing is
   * attached, or the watch is not `enabled`
   */
  initial?: boolean;
  /** stop watching at the first report of true, and hold it: later reports change nothing */
  once?: boolean;
  /** watch at all: false makes no observer and reports `initial` */
  enabled?: boolean;
};

/**
 * Watch `el` for `onChange(inView)` through an IntersectionObserver over the
 * (margined) viewport; the returned function stops watching. Nothing is
 * watched, and nothing reported, where the observer is missing (jsdom, very
 * old engines) or there is no element. The primitive under `useInView`, and
 * what the scene's own watch writes to the store with (app/useSceneLayers.ts).
 */
export function observeInView(
  el: Element | null,
  { threshold = 0, rootMargin = "0px" }: { threshold?: number; rootMargin?: string },
  onChange: (inView: boolean) => void,
): () => void {
  if (!el || typeof IntersectionObserver === "undefined") return () => {};
  const io = new IntersectionObserver(([entry]) => onChange(entry.isIntersecting), { threshold, rootMargin });
  io.observe(el);
  return () => io.disconnect();
}

/**
 * Whether an element is on screen (InViewOptions), live: a ref callback to
 * attach to it, and true while `threshold` of it crosses the viewport
 * (shrunk by `rootMargin`), false again when it leaves — the signal behind
 * everything that plays every time it is seen and undoes as it goes, where
 * `useInViewOnce` is for what draws in once and then rests. `initial` is
 * the answer until the observer's first report, and the only answer where
 * there is no observer. The watch starts once the element is attached and
 * a change of element or options starts a fresh one from `initial`,
 * letting the old one go.
 */
export function useInView<E extends Element = Element>({
  threshold = 0,
  rootMargin = "0px",
  initial = false,
  once = false,
  enabled = true,
}: InViewOptions = {}): [attach: (el: E | null) => void, inView: boolean] {
  const [el, setEl] = useState<E | null>(null);
  const watch = useMemo(
    () =>
      createWatch(initial, (set) => {
        if (!el || !enabled) return () => {};
        let held = false;
        const stop = observeInView(
          el,
          { threshold: typeof threshold === "function" ? threshold(el) : threshold, rootMargin },
          (inView) => {
            if (held || (once && !inView)) return;
            set(inView);
            if (once) {
              held = true;
              stop();
            }
          },
        );
        return stop;
      }),
    [el, threshold, rootMargin, initial, once, enabled],
  );
  return [setEl, useWatch(watch)];
}
