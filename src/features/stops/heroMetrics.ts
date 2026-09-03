/**
 * The hero headline's place and size, as CSS values: what HeroStop's Tailwind
 * classes say, written out once so the splash can set the same headline in
 * the same box before the stylesheet arrives (features/intro/staticSplash.ts,
 * #107). Tailwind finds its classes by scanning source for literal strings,
 * so HeroStop and styles.ts keep the literals; heroMetrics.test.tsx holds
 * the two to the same numbers.
 *
 * DOM-free, with relative imports: the static splash is built under the node
 * tsconfig (vite.config.ts).
 */

/** the stop's top padding, above the kicker: pt-[…] on the hero section */
export const HERO_STOP_TOP = "clamp(112px,17vh,180px)";
/** the stops' side padding from lg up (styles.ts gutter) and below it (max-lg:px-8) */
export const HERO_GUTTER = "clamp(20px,4.4vw,60px)";
export const HERO_GUTTER_BELOW_LG = "32px";

/** the kicker over the headline: its type (styles.ts kickerCls; the line height is the page's 1.5) */
export const HERO_KICKER = {
  size: "11px",
  lineHeight: "1.5",
  tracking: "0.28em",
} as const;
/** from the kicker's last line to the headline: the rule's gap (gap-3), the rule (h-px), the block's mb-[22px] */
export const HERO_KICKER_TO_HEADLINE = "35px";

/** the headline itself: HeroStop's h1 classes as values, below lg and from lg up */
export const HERO_HEADLINE_STYLE = {
  size: "clamp(42px,9vw,72px)",
  sizeLg: "clamp(42px,5.6vw,84px)",
  lineHeight: "1.02",
  tracking: "-0.005em",
  /** 15ch of Cormorant, in em (see HeroStop) */
  measure: "7.155em",
} as const;

/** Tailwind's lg, as the media queries the static splash's style writes (layout/breakpoint.ts LG_PX) */
export const LG_QUERY = "(min-width: 1024px)";
export const BELOW_LG_QUERY = "(max-width: 1023.98px)";
