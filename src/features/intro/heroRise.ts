import { gsap, SplitText } from "@/lib/gsap";

/** how long each line takes to rise, the beat between lines, and how far a line comes up, in px */
export const HERO_RISE_SECONDS = 1.2;
export const HERO_RISE_STAGGER = 0.12;
export const HERO_RISE_PX = 28;
export const HERO_RISE_EASE = "power3.out";
/** the hero headline, marked in App.tsx */
export const HERO_HEADLINE = "[data-hero-headline]";

export type HeroRise = {
  /** the lines the headline was split into */
  lines: Element[];
  /** the rise itself, to scrub in a test */
  tween: gsap.core.Tween | null;
  /** put the headline's markup back and stop the rise */
  revert: () => void;
};

/**
 * The hero headline's arrival, once the splash has handed off: its lines rise
 * into place one after another, faded, the top line first. The split is kept
 * for the life of the page and redone as the headline rewraps (SplitText's
 * autoSplit), but only the first split is animated — a resize must not replay
 * the entrance. Only ever run after a played intro, so never under reduced
 * motion. Null where there is no headline.
 */
export function riseHeroHeadline(headline: HTMLElement | null, delay = 0): HeroRise | null {
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
        opacity: 0,
        y: HERO_RISE_PX,
        duration: HERO_RISE_SECONDS,
        ease: HERO_RISE_EASE,
        stagger: HERO_RISE_STAGGER,
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
