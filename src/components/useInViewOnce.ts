import { useEffect, useState, type RefObject } from "react";

/**
 * Whether an element has been on screen yet: false until `threshold` of it
 * crosses the viewport, then true for good — the signal behind everything
 * that draws or rises in once and then rests. True from the start wherever
 * IntersectionObserver is missing (jsdom, very old engines), so nothing
 * waits on a signal that never comes. With `enabled` false the observer is
 * never made and the hook reports true, for a caller driving the state itself.
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
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold, enabled, seen]);
  return seen;
}
