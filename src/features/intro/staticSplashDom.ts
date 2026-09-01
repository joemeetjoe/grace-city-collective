import { STATIC_SPLASH_ATTR } from "./staticSplash";

/** take the static splash (index.html) out of the page; a page without one is left alone */
export function removeStaticSplash(doc: Document = document): void {
  doc.querySelector(`[${STATIC_SPLASH_ATTR}]`)?.remove();
}
