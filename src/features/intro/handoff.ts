import { STACK } from "@/theme/layerSplit";
import { TRACE_FINISH_SECONDS } from "./trace";
import { gsap } from "@/lib/gsap";

export const HANDOFF_SECONDS = 0.8;
export const HANDOFF_EASE = "power3.inOut";

/**
 * Where the splash sits once it starts to hand off: over the hero headline
 * (which fades up with the parallax) and under the nav, whose own mark the
 * travelling one lands on (see STACK in layerSplit.ts).
 */
export const HANDOFF_Z_INDEX: number = STACK.handoff;

/** the ink, fully transparent, for the splash's fade */
const INK_CLEAR = "rgba(20, 16, 14, 0)";

export type HandoffContext = {
  /** the splash root; its ink fades to transparent */
  root: HTMLElement;
  /** the splash's G mark, which travels to the nav */
  mark: SVGSVGElement | null;
  /** the mark's red rule, which closes before anything moves */
  rule: SVGPathElement | null;
  /** the nav's own G mark, if rendered at this breakpoint */
  nav: SVGSVGElement | null;
  /** the scene's canvases (`[data-parallax]`, `[data-parallax-front]`), whichever are rendered */
  parallax: HTMLElement | HTMLElement[] | null;
  onComplete: () => void;
};

/** the nav's G mark, the traveller's destination */
export const NAV_MARK = "[data-nav-mark] [data-g-mark]";

/** whether an element takes up room on screen (not display: none) */
function laidOut(el: Element | null): el is SVGSVGElement {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

/**
 * The nav's mark at this breakpoint: the phone bar's and the xl corner's are
 * both in the DOM, one of them display: none, so the laid-out one is the one
 * the traveller can land on; null where neither is (the mark fades in place).
 */
export function navMark(root: ParentNode = document): SVGSVGElement | null {
  return Array.from(root.querySelectorAll<SVGSVGElement>(NAV_MARK)).find(laidOut) ?? null;
}

/**
 * The handoff: the rule closes its last corner, then the big mark shrinks
 * into the nav's mark while the splash's ink fades out and the parallax
 * fades up underneath. Where the nav has no mark (below xl), the mark fades
 * in place instead.
 */
export function buildHandoff({ root, mark, rule, nav, parallax, onComplete }: HandoffContext): gsap.core.Timeline {
  const tl = gsap.timeline({ onComplete });

  if (rule) {
    tl.to(rule, { attr: { "stroke-dashoffset": 0 }, duration: TRACE_FINISH_SECONDS, ease: "power2.inOut" }, 0);
  }
  const at = TRACE_FINISH_SECONDS;

  gsap.set(root, { zIndex: HANDOFF_Z_INDEX });
  if (mark && laidOut(nav)) {
    const from = mark.getBoundingClientRect();
    const to = nav.getBoundingClientRect();
    // the nav's copy waits, hidden, until the traveller has landed on it
    gsap.set(nav, { opacity: 0 });
    tl.to(
      mark,
      {
        x: to.left - from.left,
        y: to.top - from.top,
        scale: to.height / from.height,
        transformOrigin: "0 0",
        duration: HANDOFF_SECONDS,
        ease: HANDOFF_EASE,
      },
      at,
    );
    tl.set(nav, { clearProps: "opacity" }, at + HANDOFF_SECONDS);
  } else if (mark) {
    tl.to(mark, { opacity: 0, duration: HANDOFF_SECONDS / 2, ease: "power2.out" }, at);
  }

  // the ink, not the root's opacity: the mark must stay solid while it travels
  tl.to(root, { backgroundColor: INK_CLEAR, duration: HANDOFF_SECONDS, ease: HANDOFF_EASE }, at);
  if (parallax && (!Array.isArray(parallax) || parallax.length)) {
    tl.to(parallax, { opacity: 1, duration: HANDOFF_SECONDS, ease: HANDOFF_EASE }, at);
  }
  return tl;
}
