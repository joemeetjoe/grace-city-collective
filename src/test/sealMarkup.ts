/**
 * A seal's markup with the per-instance ids and the live overlay stripped, so
 * a live seal can be compared to a static one (or to itself after a beat).
 * Empty `style=""` attributes, which clearProps leaves behind, are dropped.
 */
export function baseMarkup(svg: Element): string {
  const clone = svg.cloneNode(true) as Element;
  clone.querySelector('[data-seal="live"]')?.remove();
  return clone.outerHTML.replace(/(id="|url\(#|href="#)[^"()]+/g, "$1x").replace(/ style=""/g, "");
}
