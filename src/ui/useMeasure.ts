import { useLayoutEffect, useState } from "react";

/**
 * Call `onResize` whenever `el` changes size, through a ResizeObserver, or
 * on every window resize where the observer is missing (very old engines,
 * jsdom); the returned function stops listening.
 */
export function observeResize(el: Element, onResize: () => void): () => void {
  if (typeof ResizeObserver === "undefined") {
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }
  const ro = new ResizeObserver(onResize);
  ro.observe(el);
  return () => ro.disconnect();
}

/**
 * A measurement of an element, kept current: `read` runs on the element the
 * returned ref is attached to, before the first paint with it (a layout
 * effect, so what is drawn from the measure — a script line, a settled
 * height — is right from the first frame), and again on every resize of the
 * element (observeResize). `initial` stands until then, and for good while
 * nothing is attached. The one measuring hook: `read` must be stable (a
 * module-level function), since a new one is a fresh measure.
 */
export function useMeasure<E extends Element, T>(
  read: (el: E) => T,
  initial: T,
): [attach: (el: E | null) => void, value: T] {
  const [el, setEl] = useState<E | null>(null);
  const [value, setValue] = useState(initial);
  useLayoutEffect(() => {
    if (!el) return;
    const measure = () => setValue(read(el));
    measure();
    return observeResize(el, measure);
  }, [el, read]);
  return [setEl, value];
}
