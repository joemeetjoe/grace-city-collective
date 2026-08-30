import { useEffect, useState, type RefObject } from "react";

/**
 * The most of a viewport's worth of a block that may have to show before it
 * is let in, whatever `threshold` asks: no block waits hidden past about
 * half a screen.
 */
export const IN_VIEW_MAX_SHARE = 0.4;

/**
 * The threshold to watch an element with. IntersectionObserver's threshold
 * is a fraction of the *target*, so for a block taller than the viewport a
 * fixed fraction is reached late (20% of a 3500px list is 700px of nothing)
 * or never. Capped so the fraction asked for is never more than
 * `IN_VIEW_MAX_SHARE` of a viewport against the element's own height; an
 * unmeasurable height (0, jsdom) leaves the threshold alone.
 */
export function cappedThreshold(
  threshold: number,
  viewportHeight: number,
  elementHeight: number,
): number {
  if (!(elementHeight > 0) || !(viewportHeight > 0)) return threshold;
  return Math.min(
    threshold,
    (IN_VIEW_MAX_SHARE * viewportHeight) / elementHeight,
  );
}

/**
 * Whether an element has been on screen yet: false until `threshold` of it
 * crosses the viewport, then true for good — the signal behind everything
 * that draws or rises in once and then rests. The threshold is capped by
 * the element's height against the viewport (`cappedThreshold`), so a tall
 * block comes in once about half a screen of it shows, never later. True
 * from the start wherever IntersectionObserver is missing (jsdom, very old
 * engines), so nothing waits on a signal that never comes. With `enabled`
 * false the observer is never made and the hook reports true, for a caller
 * driving the state itself.
 */
export function useInViewOnce(
  ref: RefObject<Element | null>,
  threshold = 0,
  enabled = true,
): boolean {
  const [seen, setSeen] = useState(
    () => !enabled || typeof IntersectionObserver === "undefined",
  );
  useEffect(() => {
    const el = ref.current;
    if (seen || !enabled || !el || typeof IntersectionObserver === "undefined")
      return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setSeen(true);
        io.disconnect();
      },
      {
        threshold: cappedThreshold(
          threshold,
          window.innerHeight,
          el.getBoundingClientRect().height,
        ),
      },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold, enabled, seen]);
  return seen;
}
