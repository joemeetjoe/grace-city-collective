import { readScrollTop, type ScrollDriver } from "./position";

export type JumpOptions = {
  /** land at once, no tween: a deep link on load, where a glide would be a page arriving twice */
  immediate?: boolean;
  doc?: Document;
  win?: Window;
};

/**
 * The in-page nav: scroll to `#id`, easing through the smoother when there is
 * one and through the browser otherwise — or landing at once when
 * `immediate`. Honours the target's scroll-margin-top (the long-form
 * headings keep clear of the fixed nav). False when the id is not on the
 * page.
 */
export function jumpTo(
  id: string,
  driver: ScrollDriver | null,
  { immediate = false, doc = document, win = window }: JumpOptions = {},
): boolean {
  const el = doc.getElementById(id);
  if (!el) return false;
  // bounding rects follow the smoothed position, so this sum is document-relative either way
  const margin = parseFloat(win.getComputedStyle(el).scrollMarginTop) || 0;
  const top = el.getBoundingClientRect().top + readScrollTop(driver, doc) - margin;
  if (driver) driver.scrollTo(top, !immediate);
  else win.scrollTo({ top, behavior: immediate ? "instant" : "smooth" });
  return true;
}
