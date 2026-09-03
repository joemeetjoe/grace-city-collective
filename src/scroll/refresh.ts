import { ScrollTrigger } from "gsap/ScrollTrigger";

import { gsap } from "@/lib/gsap";

// registering again elsewhere is a no-op
gsap.registerPlugin(ScrollTrigger);

/**
 * Re-measure every ScrollTrigger — the section watch, the smoother's own
 * scroll range — after the page's boxes change without a resize: the
 * long-form chunk mounting into its placeholder sections (#111). ScrollTrigger
 * caches each trigger's start and end and only re-reads them on a refresh,
 * which nothing but a window resize causes on its own. Synchronous, so a
 * caller in a layout effect has the new positions before the next paint.
 */
export function refreshScrollPositions(): void {
  ScrollTrigger.refresh();
}
