import { SplitText } from "gsap/SplitText";

import { gsap } from "@/lib/gsap";
import { HERO_RISE_EASE, HERO_RISE_SECONDS, HERO_RISE_STAGGER, HERO_SETTLE_SECONDS, HERO_SETTLE_STAGGER } from "@/theme/motion";

// the split below; registering again elsewhere is a no-op
gsap.registerPlugin(SplitText);

/** how far a line comes up, in px (its rise and the beat between lines: theme/motion.ts) */
export const HERO_RISE_PX = 28;
/**
 * The settle (#107): the headline stood on the splash from the first paint,
 * so its lines have nowhere to rise from. The handoff lifts the splash's
 * headline this far while the ink dissolves (handoff.ts), and the hero's
 * lines, taking its place at the same height, settle back down one after
 * another — the same lines, never faded (their seconds and beat: theme/motion.ts).
 */
export const HERO_SETTLE_PX = 8;

/** how the headline arrives: risen from below, faded, or settled from where the splash left it */
export type HeroEntrance = "rise" | "settle";

export type HeroRise = {
  /** the lines the headline was split into */
  lines: Element[];
  /** the rise itself, to scrub in a test */
  tween: gsap.core.Tween | null;
  /** put the headline's markup back and stop the rise */
  revert: () => void;
};

/** where the lines start from, and how they move, for each entrance */
const ENTRANCES: Record<HeroEntrance, gsap.TweenVars> = {
  rise: { opacity: 0, y: HERO_RISE_PX, duration: HERO_RISE_SECONDS, stagger: HERO_RISE_STAGGER },
  settle: { y: -HERO_SETTLE_PX, duration: HERO_SETTLE_SECONDS, stagger: HERO_SETTLE_STAGGER },
};

/**
 * The hero headline's arrival, once the splash has handed off: its lines rise
 * into place one after another, faded, the top line first — or, when the
 * headline stood on the splash already (splashComposition.ts), settle the
 * last few px from where the handoff lifted it, top line first, never
 * faded. The split is kept for the life of the page and redone as the
 * headline rewraps (SplitText's autoSplit), but only the first split is
 * animated — a resize must not replay the entrance. Only ever run after a
 * played intro, so never under reduced motion. Null where there is no
 * headline (the page registers the hero's, kind "headline": state/revealTargets.ts).
 */
export function riseHeroHeadline(headline: HTMLElement | null, delay = 0, entrance: HeroEntrance = "rise"): HeroRise | null {
  if (!headline) return null;
  let tween: gsap.core.Tween | null = null;
  let lines: Element[] = [];
  const split = SplitText.create(headline, {
    type: "lines",
    linesClass: "hero-line",
    autoSplit: true,
    onSplit: (self) => {
      lines = self.lines;
      if (tween) return;
      tween = gsap.from(self.lines, {
        ...ENTRANCES[entrance],
        ease: HERO_RISE_EASE,
        delay,
        clearProps: "opacity,transform",
      });
      return tween;
    },
  });
  return {
    get lines() {
      return lines;
    },
    get tween() {
      return tween;
    },
    revert: () => {
      tween?.kill();
      split.revert();
    },
  };
}
