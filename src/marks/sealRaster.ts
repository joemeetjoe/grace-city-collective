/** the seal's own markup with its live overlay showing, as an SVG data URL */
export function rasterOfLiveLook(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelector('[data-seal="rest"]')?.remove();
  const overlay = clone.querySelector<SVGElement>('[data-seal="live"]');
  if (overlay) overlay.style.display = "";
  clone.removeAttribute("class");
  clone.removeAttribute("style");
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return `data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(clone))}`;
}
