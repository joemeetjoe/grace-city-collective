import { useEffect, useState, type RefObject } from "react";

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

export type InViewOptions = {
  /** the fraction of the element that must be in the (margined) viewport */
  threshold?: number;
  /** the viewport's margin, as IntersectionObserver takes it: negative values shrink it to a band */
  rootMargin?: string;
  /**
   * what to report before the observer answers, and for good wherever
   * IntersectionObserver is missing (jsdom, very old engines) or the ref
   * holds nothing
   */
  initial?: boolean;
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
  { threshold = 0, rootMargin = "0px" }: Omit<InViewOptions, "initial">,
  onChange: (inView: boolean) => void,
): () => void {
  if (!el || typeof IntersectionObserver === "undefined") return () => {};
  const io = new IntersectionObserver(([entry]) => onChange(entry.isIntersecting), { threshold, rootMargin });
  io.observe(el);
  return () => io.disconnect();
}

/**
 * Whether an element is on screen, live: true while `threshold` of it
 * crosses the viewport (shrunk by `rootMargin`), false again when it
 * leaves — the signal behind everything that plays every time it is
 * seen and undoes as it goes, where `useInViewOnce` is for what draws in
 * once and then rests. `initial` is the answer until the observer's first
 * report, and the only answer where there is no observer.
 */
export function useInView(
  ref: RefObject<Element | null>,
  { threshold = 0, rootMargin = "0px", initial = false }: InViewOptions = {},
): boolean {
  const [inView, setInView] = useState(initial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const stop = observeInView(el, { threshold, rootMargin }, setInView);
    return () => {
      stop();
      // the next watch starts from `initial` again, not from the last report
      setInView(initial);
    };
  }, [ref, threshold, rootMargin, initial]);
  return inView;
}
