/**
 * How the page's scroll position is read. With ScrollSmoother driving, the
 * content sits where the *smoothed* position says, not where the native
 * scrollbar is, so anything doing document-relative maths against bounding
 * rects (the damped camera, the nav jumps) must read through the driver.
 * There is no singleton: the driver lives on the smoother's handle
 * (smoother.ts), and useSmoothScroll hands out an accessor over it.
 */
export type ScrollDriver = {
  /** the smoothed scroll position, in px */
  scrollTop(): number;
  /** scroll to a document position; `smooth` eases there instead of jumping */
  scrollTo(top: number, smooth?: boolean): void;
};

/** the driver's smoothed position, or the document's own scrollTop without one */
export function readScrollTop(from: ScrollDriver | null, doc: Document = document): number {
  return from ? from.scrollTop() : doc.documentElement.scrollTop;
}
