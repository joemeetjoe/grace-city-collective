/**
 * How the splash is composed (#107): where the ruled G mark sits on the ink
 * and how big it is, and whether the hero headline stands beside it, in the
 * hero's own box, from the first paint. The headline is the page's largest
 * text and so its LCP element; on the splash it paints with the page's
 * first frame instead of after the gate, and the handoff has nothing to
 * move — the hero's h1 takes its place (useIntroGate.ts) and settles.
 *
 * SPLASH_COMPOSITION picks one. The three with the headline are the
 * options shot for the design pass (docs/design/issue-107/README.md);
 * `markOnly` is the splash as it was before this issue — switch to it to
 * revert. Each names the mark's size as its share of the short viewport
 * side (svh) and of the width (vw), whichever binds first, and lays the
 * mark out on the splash root with flex alignment and padding, from lg up
 * and below it; the headline's box is the hero's (stops/heroMetrics.ts)
 * and does not vary between them.
 *
 * DOM-free, with relative imports: the static splash is built under the
 * node tsconfig (vite.config.ts).
 */
import { HERO_GUTTER, HERO_GUTTER_BELOW_LG } from "../stops/heroMetrics";

export type SplashComposition = {
  /** the hero headline stands on the splash, in the hero's box */
  headline: boolean;
  /** the mark's height as a share of the viewport height (svh) */
  markSvh: number;
  /** the mark's width as a share of the viewport width (vw) */
  markVw: number;
  /** the splash root's alignment and padding: flex on a fixed sheet, from lg up */
  layout: string;
  /** the same, below lg */
  layoutBelowLg: string;
  /** further rules below lg, whole (selector and block), for a layout that moves the headline's block or the mark */
  belowLgRules?: string;
};

/** the mark on either splash root, for a rule of its own */
const MARK = "[data-intro-static]>svg,[data-intro-splash]>svg";

/** the lockup's bottom offset from the frame's foot (HeroLockup, HeroStop's pb) */
const FOOT = "clamp(22px,4.2vw,52px)";
/** the nav bar's inset from the viewport edge (SiteNav) */
const NAV_INSET = "clamp(9px,2.4vw,26px)";

export const SPLASH_COMPOSITIONS = {
  /** the splash before #107: the mark alone, centred, as tall as the viewport allows */
  markOnly: {
    headline: false,
    markSvh: 72,
    markVw: 72,
    layout: "align-items:center;justify-content:center",
    layoutBelowLg: "align-items:center;justify-content:center",
  },
  /**
   * recto: the headline on the left page, the mark on the right — set at
   * the gutter, mid-height, as a title page faces its frontispiece. Below
   * lg the sheet is a column: the headline's block in the flow, then the
   * mark right-set under it at the gutter, a seal after a signature
   */
  recto: {
    headline: true,
    markSvh: 48,
    markVw: 46,
    layout: `align-items:center;justify-content:flex-end;padding:0 ${HERO_GUTTER} 0 0`,
    layoutBelowLg: `flex-direction:column;align-items:flex-end;justify-content:flex-start;padding:0 ${HERO_GUTTER_BELOW_LG} 0 0`,
    belowLgRules:
      `[data-splash-copy]{position:static;align-self:stretch;padding-right:0}` +
      `${MARK}{order:1;margin-top:8svh}`,
  },
  /**
   * colophon: the headline top-left, the mark bottom-right on the lockup's
   * foot line, the two pinning the frame's opposite corners; below lg the
   * mark sits lower right, over the lockup's band, like a seal after a
   * signature
   */
  colophon: {
    headline: true,
    markSvh: 36,
    markVw: 46,
    layout: `align-items:flex-end;justify-content:flex-end;padding:0 ${HERO_GUTTER} ${FOOT} 0`,
    layoutBelowLg: `align-items:flex-end;justify-content:flex-end;padding:0 ${HERO_GUTTER_BELOW_LG} 18svh 0`,
  },
  /**
   * letterhead: a small mark at the gutter over the headline, as a device
   * heads a sheet of letter paper; the headline follows a clear space below
   */
  letterhead: {
    headline: true,
    markSvh: 11,
    markVw: 22,
    layout: `align-items:flex-start;justify-content:flex-start;padding:calc(${NAV_INSET} + 26px) 0 0 ${HERO_GUTTER}`,
    layoutBelowLg: `align-items:flex-start;justify-content:flex-start;padding:52px 0 0 ${HERO_GUTTER_BELOW_LG}`,
  },
} as const satisfies Record<string, SplashComposition>;

export type SplashCompositionName = keyof typeof SPLASH_COMPOSITIONS;

/**
 * The composition the splash wears. Pending sign-off (#107, HITL): chosen
 * against the brand skills with the user away; the options are in
 * docs/design/issue-107/. Change this one name to switch, or to `markOnly`
 * to revert to the splash without the headline.
 */
export const SPLASH_COMPOSITION_NAME: SplashCompositionName = "recto";

export const SPLASH_COMPOSITION: SplashComposition = SPLASH_COMPOSITIONS[SPLASH_COMPOSITION_NAME];

/** whether the hero headline stands on the splash this build */
export const SPLASH_HEADLINE: boolean = SPLASH_COMPOSITION.headline;
