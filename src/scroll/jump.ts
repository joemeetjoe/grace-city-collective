import { readScrollTop, type ScrollDriver } from "./position";

/**
 * The in-page nav: scroll to `#id`, easing through the smoother when there is
 * one and through the browser otherwise. Honours the target's scroll-margin-top
 * (the long-form headings keep clear of the fixed nav). False when the id is
 * not on the page.
 */
export function jumpTo(
  id: string,
  driver: ScrollDriver | null,
  doc: Document = document,
  win: Window = window,
): boolean {
  const el = doc.getElementById(id);
  if (!el) return false;
  // bounding rects follow the smoothed position, so this sum is document-relative either way
  const margin = parseFloat(win.getComputedStyle(el).scrollMarginTop) || 0;
  const top = el.getBoundingClientRect().top + readScrollTop(driver, doc) - margin;
  if (driver) driver.scrollTo(top, true);
  else win.scrollTo({ top, behavior: "smooth" });
  return true;
}
