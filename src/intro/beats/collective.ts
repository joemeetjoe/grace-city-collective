import { gsap } from "@/lib/gsap";
import type { IntroBeat } from "@/intro/timeline";

/** How long the pen takes to write "Collective". */
export const COLLECTIVE_DRAW_SECONDS = 1.2;

/**
 * Pen pacing: the main run — the word and its long connecting strokes — is
 * written briskly with a gentle in/out, then the pen slows into the final
 * flourish (t-bar, i-dot) and lifts off softly.
 */
const MAIN_RUN_END = "90%";
const MAIN_RUN_SECONDS = 0.9;
const FLOURISH_SECONDS = COLLECTIVE_DRAW_SECONDS - MAIN_RUN_SECONDS;

/** "Collective" is written in cursive after the wordmark wipe, first stroke to last. */
export const collectiveBeat: IntroBeat = {
  label: "collective",
  add(tl, { script }, at) {
    if (!script) return;
    const path = script.querySelector<SVGPathElement>('[data-script="collective"]');
    if (!path) return;
    // No ink may show before the wipe has finished.
    gsap.set(path, { visibility: "hidden", drawSVG: "0%" });
    tl.set(path, { visibility: "visible" }, at)
      .to(path, { drawSVG: `0% ${MAIN_RUN_END}`, duration: MAIN_RUN_SECONDS, ease: "power1.inOut" }, at)
      .to(path, { drawSVG: "0% 100%", duration: FLOURISH_SECONDS, ease: "power2.out" }, `${at}+=${MAIN_RUN_SECONDS}`)
      // Drop the dash styling so the drawn path is the resting script, byte for byte.
      .set(path, { clearProps: "strokeDasharray,strokeDashoffset,visibility" }, `${at}+=${COLLECTIVE_DRAW_SECONDS}`);
  },
};
