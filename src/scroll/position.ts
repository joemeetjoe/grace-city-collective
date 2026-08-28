/**
 * The one place the page's scroll position is read from. With ScrollSmoother
 * driving, the content sits where the *smoothed* position says, not where the
 * native scrollbar is, so anything doing document-relative maths against
 * bounding rects (the damped camera, the nav jumps) must read through here.
 */
export type ScrollDriver = {
  /** the smoothed scroll position, in px */
  scrollTop(): number;
  /** scroll to a document position; `smooth` eases there instead of jumping */
  scrollTo(top: number, smooth?: boolean): void;
};

let driver: ScrollDriver | null = null;

/** the smoother module installs itself here when it creates an instance; null returns to native scroll */
export function installScrollDriver(next: ScrollDriver | null): void {
  driver = next;
}

export function getScrollDriver(): ScrollDriver | null {
  return driver;
}

/** the driver's smoothed position, or the document's own scrollTop without one */
export function readScrollTop(from: ScrollDriver | null, doc: Document = document): number {
  return from ? from.scrollTop() : doc.documentElement.scrollTop;
}

/** the current scroll position, whichever is driving */
export function getScrollTop(): number {
  return readScrollTop(driver);
}
