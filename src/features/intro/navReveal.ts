import { gsap } from "@/lib/gsap";
import {
  NAV_REVEAL_ACTIONS_AT,
  NAV_REVEAL_DOTS_AT,
  NAV_REVEAL_EASE,
  NAV_REVEAL_SECONDS,
  NAV_REVEAL_STAGGER,
} from "@/theme/motion";
import { rgba, tokens } from "@/theme/tokens";

/** how far a link drops into place, and how far a dot slides in from the edge, in px (the timings: theme/motion.ts) */
export const NAV_REVEAL_DROP = 8;
export const NAV_REVEAL_SLIDE = 8;

/** the ink and cream with no alpha: what the nav's glass fades up from */
const INK_CLEAR = rgba(tokens.ink, 0);
const CREAM_CLEAR = rgba(tokens.cream, 0);

export type NavRevealTargets = {
  /** the section links, nearest the mark first */
  links: Element[];
  /** the calls to action, nearest the links first */
  actions: Element[];
  /** the dot rail's dots, top to bottom */
  dots: Element[];
  /** the frosted glass behind the links and the dots */
  glass: Element[];
};

/**
 * Everything the cascade moves, read from the page: the section links are
 * played from the mark outward, so their document order is reversed, as is
 * the calls to action's, which sit to the left of the links.
 */
export function collectNavReveal(root: ParentNode = document): NavRevealTargets {
  const all = (sel: string) => Array.from(root.querySelectorAll(sel));
  return {
    links: all("[data-nav-links] [data-nav-reveal]").reverse(),
    actions: all("[data-nav-actions] [data-nav-reveal]").reverse(),
    dots: all("[data-dot-rail] [data-nav-reveal]"),
    glass: all("[data-nav-glass]"),
  };
}

/**
 * The nav's arrival, once the splash's mark has landed on the nav's own: the
 * section links drop in one by one, outward from the mark, while the glass
 * behind them fades up; the calls to action follow on the left, and the dot
 * rail slides in from the right edge. Every tween hands its styles back to
 * CSS when it is done. Only ever built after a played intro, so never under
 * reduced motion (the intro does not play there).
 */
export function buildNavReveal({ links, actions, dots, glass }: NavRevealTargets): gsap.core.Timeline {
  const tl = gsap.timeline();
  const arrive = (els: Element[], from: gsap.TweenVars, at: number, stagger: number) => {
    if (!els.length) return;
    tl.fromTo(
      els,
      { opacity: 0, ...from },
      {
        opacity: 1,
        x: 0,
        y: 0,
        duration: NAV_REVEAL_SECONDS,
        ease: NAV_REVEAL_EASE,
        stagger,
        clearProps: "opacity,transform",
      },
      at,
    );
  };
  if (glass.length) {
    // from clear to whatever the glass's classes say, read at the start
    tl.from(
      glass,
      {
        backgroundColor: INK_CLEAR,
        borderColor: CREAM_CLEAR,
        duration: NAV_REVEAL_SECONDS,
        ease: NAV_REVEAL_EASE,
        clearProps: "backgroundColor,borderColor",
      },
      0,
    );
  }
  arrive(links, { y: -NAV_REVEAL_DROP }, 0, NAV_REVEAL_STAGGER);
  arrive(actions, { y: -NAV_REVEAL_DROP }, NAV_REVEAL_ACTIONS_AT, NAV_REVEAL_STAGGER);
  arrive(dots, { x: NAV_REVEAL_SLIDE }, NAV_REVEAL_DOTS_AT, NAV_REVEAL_STAGGER / 2);
  return tl;
}
