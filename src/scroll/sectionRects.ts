/**
 * The scene's section stack as measured rects (#64). The tick used to call
 * getBoundingClientRect per section per frame — a forced synchronous layout
 * interleaved with ScrollSmoother writing transforms in the same frame. The
 * rects are measured once (and again on resize or when a section's box
 * changes) and the per-frame read becomes pure arithmetic on the cache.
 */

export type SectionRect = {
  /** document-relative top, in CSS px */
  top: number;
  height: number;
};

/**
 * Where `centreY` (a document-relative y, usually scrollTop + half the
 * viewport) falls in the section stack: an index plus the fraction through
 * it. Unclamped past the end: the last section runs to `rects.length`, which
 * is how the embers see the scene slide away; the camera clamps it to the
 * last waypoint. Mirrors the old element-walking semantics exactly.
 */
export function sectionProgressAt(centreY: number, rects: readonly SectionRect[]): number {
  for (let i = 0; i < rects.length; i++) {
    const { top, height } = rects[i];
    if (centreY < top + height || i === rects.length - 1) {
      const t = Math.min(1, Math.max(0, (centreY - top) / height));
      return i + t;
    }
  }
  return 0;
}

/**
 * Measure the stack. `scrollY` must be the same scroll the tick will read
 * (the page scroll's scrollTop, useSmoothScroll.ts): with ScrollSmoother the rects sit where it says, not where
 * the native scrollbar is, and `rect.top + scrollY` cancels the transform
 * back out to a document-relative top.
 */
export function measureSections(els: readonly HTMLElement[], scrollY: number): SectionRect[] {
  return els.map((el) => ({ top: el.getBoundingClientRect().top + scrollY, height: el.offsetHeight }));
}
