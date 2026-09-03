import { LIVE_SPLASH_ATTR, STATIC_SPLASH_ATTR, staticSplashMarkup } from "./staticSplash";

/** take the static splash (index.html) out of the page; a page without one is left alone */
export function removeStaticSplash(doc: Document = document): void {
  doc.querySelector(`[${STATIC_SPLASH_ATTR}]`)?.remove();
}

/**
 * The static splash, taken over by the live one: the same root, marked
 * live as well, so the composition's rules and the handoff's queries find
 * it either way. Its headline is the page's LCP element (#107) — a
 * re-created h1 would be a new, later candidate — so nothing here is
 * rebuilt; the mark carries GMark's hooks already (staticSplash.ts). A page
 * with no static splash (a test, a dev page without the plugin) gets one
 * from the same markup, at the top of the body. Adopted, the splash is
 * decoration to assistive tech, as the live one always was: the hero's own
 * h1 is the page's heading, and it is on its way.
 */
export function adoptStaticSplash(doc: Document = document): HTMLElement {
  let root = doc.querySelector<HTMLElement>(`[${STATIC_SPLASH_ATTR}]`);
  if (!root) {
    doc.body.insertAdjacentHTML("afterbegin", staticSplashMarkup());
    root = doc.querySelector<HTMLElement>(`[${STATIC_SPLASH_ATTR}]`)!;
  }
  root.setAttribute(LIVE_SPLASH_ATTR, "");
  root.setAttribute("aria-hidden", "true");
  return root;
}
