/**
 * The splash as static markup, in index.html before any script runs: the G
 * mark on ink with its rule undrawn, and beside it the hero headline in the
 * hero's own box (#107), so the page's first paint is the splash — headline
 * and all, the LCP element with the first frame — and not bare ink waiting
 * on the bundle. IntroSplash adopts it as it stands (staticSplashDom.ts):
 * the headline is the LCP element, and an h1 re-created at mount would be
 * a new, later candidate, so this one node stays until the handoff ends.
 * The inline script removes the splash at once in a session the intro will
 * not play in, mirroring shouldPlayIntro, so a repeat visit never flashes
 * the mark.
 *
 * The headline's box is the hero's, built the way HeroStop builds it — the
 * stop's top padding, the kicker (unseen, but taking its lines), the gap to
 * the headline, the headline's measure and type (stops/heroMetrics.ts) — so
 * the two h1s coincide and the handoff has nothing to move. Where the mark
 * sits is the composition (splashComposition.ts).
 *
 * DOM-free, with relative imports: vite.config.ts injects these tags, and is
 * built under the node tsconfig.
 */
import {
  G_MARK_CORNER,
  G_MARK_LETTER,
  RULE_CORNER,
  RULE_GAP,
  RULE_PAD,
  RULE_WEIGHT,
  G_MARK_H,
  G_MARK_W,
  gMarkAspect,
  gMarkBox,
} from "../../marks/gMarkGeometry";
import { site } from "../../content/site";
import { FONT_FALLBACK_CSS } from "../../theme/fontFallback";
import { FONT_SANS, FONT_SERIF } from "../../theme/fonts";
import { tokens } from "../../theme/tokens";
import { REDUCED_MOTION_QUERY } from "../../device/reducedMotion";
import {
  BELOW_LG_QUERY,
  HERO_GUTTER,
  HERO_GUTTER_BELOW_LG,
  HERO_HEADLINE_STYLE,
  HERO_KICKER,
  HERO_KICKER_TO_HEADLINE,
  HERO_STOP_TOP,
  LG_QUERY,
} from "../stops/heroMetrics";
import { INTRO_PLAYED_KEY } from "./introKeys";
import { SPLASH_COMPOSITION } from "./splashComposition";
import { SPLASH_MARK_SIZE } from "./splashMark";

/** marks the static splash's root */
export const STATIC_SPLASH_ATTR = "data-intro-static";
/** marks the splash once IntroSplash has adopted it; the layout below is keyed on both */
export const LIVE_SPLASH_ATTR = "data-intro-splash";
/** the headline's block on the splash, the kicker's stand-in in it, and the headline itself */
export const SPLASH_COPY_ATTR = "data-splash-copy";
export const SPLASH_KICKER_ATTR = "data-splash-kicker";
export const SPLASH_HEADLINE_ATTR = "data-splash-headline";

/**
 * The ink, on the document and the body, before any stylesheet arrives: the
 * stylesheet is loaded without blocking (src/lib/asyncCss.ts), so this is
 * all a visit paints with until it lands — the splash carries its own layout
 * inline, and a visit without the splash shows ink with no body margin
 * rather than a white page.
 */
export const STATIC_SPLASH_STYLE = `html{background:${tokens.ink}}body{margin:0;background:${tokens.ink}}`;

/**
 * The composition's layout on both splash roots — the static one and
 * IntroSplash's — and the headline's block: the hero's box, rule for rule
 * (stops/heroMetrics.ts), in the tokens and the font stacks themselves.
 * Attribute selectors, unlayered, so they beat the UA's h1 before the
 * stylesheet lands and the preflight's after. The kicker is laid out unseen
 * so the headline sits under it exactly as it does in the hero, however
 * many lines the kicker takes at this width.
 */
export const SPLASH_LAYOUT_CSS =
  `[${STATIC_SPLASH_ATTR}],[${LIVE_SPLASH_ATTR}]{${SPLASH_COMPOSITION.layout}}` +
  `@media ${BELOW_LG_QUERY}{[${STATIC_SPLASH_ATTR}],[${LIVE_SPLASH_ATTR}]{${SPLASH_COMPOSITION.layoutBelowLg}}}` +
  `[${SPLASH_COPY_ATTR}]{position:absolute;top:0;left:0;right:0;padding:${HERO_STOP_TOP} ${HERO_GUTTER} 0;` +
  `color:${tokens.cream};-webkit-font-smoothing:antialiased}` +
  `[${SPLASH_KICKER_ATTR}]{margin:0;visibility:hidden;font-family:${FONT_SANS};font-size:${HERO_KICKER.size};` +
  `line-height:${HERO_KICKER.lineHeight};font-weight:400;letter-spacing:${HERO_KICKER.tracking};text-transform:uppercase;text-wrap:balance}` +
  `[${SPLASH_HEADLINE_ATTR}]{margin:${HERO_KICKER_TO_HEADLINE} 0 0;max-width:${HERO_HEADLINE_STYLE.measure};font-family:${FONT_SERIF};` +
  `font-size:${HERO_HEADLINE_STYLE.size};line-height:${HERO_HEADLINE_STYLE.lineHeight};font-weight:400;` +
  `letter-spacing:${HERO_HEADLINE_STYLE.tracking};text-wrap:pretty}` +
  `@media ${BELOW_LG_QUERY}{[${SPLASH_COPY_ATTR}]{padding-left:${HERO_GUTTER_BELOW_LG};padding-right:${HERO_GUTTER_BELOW_LG}}}` +
  `@media ${LG_QUERY}{[${SPLASH_HEADLINE_ATTR}]{font-size:${HERO_HEADLINE_STYLE.sizeLg}}}` +
  (SPLASH_COMPOSITION.belowLgRules ? `@media ${BELOW_LG_QUERY}{${SPLASH_COMPOSITION.belowLgRules}}` : "");

/**
 * Everything the inline head style carries: the ink, then the metric-matched
 * fallback faces (theme/fontFallback.ts), declared here so they exist before
 * any text can paint — the headline set in one of them before its woff2
 * lands takes the same line boxes and moves nothing when the swap happens —
 * then the splash's layout.
 */
export const INLINE_HEAD_STYLE = `${STATIC_SPLASH_STYLE}${FONT_FALLBACK_CSS}${SPLASH_LAYOUT_CSS}`;

/**
 * The ruled G mark, as GMark renders it for the splash: same viewBox, paths
 * and size, and the same hooks (`data-g-mark`, `data-g-mark-rule`) — the
 * live splash adopts this very element and traces its rule (IntroSplash).
 */
export function staticSplashSvg(): string {
  const vw = G_MARK_W + 2 * RULE_PAD;
  const vh = G_MARK_H + 2 * RULE_PAD;
  const size = SPLASH_MARK_SIZE;
  const style = `width:calc(${size} * ${gMarkAspect(true)});height:${size}`;
  const rule = gMarkBox(-RULE_GAP, RULE_CORNER);
  const mark = `${gMarkBox(0, G_MARK_CORNER)} ${G_MARK_LETTER}`;
  return (
    `<svg aria-hidden="true" data-g-mark="" viewBox="${-RULE_PAD} ${-RULE_PAD} ${vw} ${vh}" style="${style}">` +
    `<path data-g-mark-rule="" d="${rule}" fill="none" stroke="${tokens.seal}" stroke-width="${RULE_WEIGHT}" ` +
    `pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"></path>` +
    `<path fill="${tokens.cream}" fill-rule="evenodd" d="${mark}"></path>` +
    `</svg>`
  );
}

/** the splash's root: a fixed sheet of ink, laid out by the composition (SPLASH_LAYOUT_CSS), as IntroSplash's is */
export const STATIC_SPLASH_LAYOUT = `position:fixed;inset:0;z-index:50;display:flex;background:${tokens.ink}`;

const escapeHtml = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** the hero stop's words, from the site content: the kicker's stand-in and the headline */
const splashHero = () => site.scene[0];

/**
 * The headline's block: the kicker's lines, unseen, then the headline, in
 * the hero's box; nothing, for a composition without the headline.
 */
export function staticSplashCopy(): string {
  if (!SPLASH_COMPOSITION.headline) return "";
  const { kicker = "", heading } = splashHero();
  return (
    `<div ${SPLASH_COPY_ATTR}="">` +
    `<p ${SPLASH_KICKER_ATTR}="">${escapeHtml(kicker)}</p>` +
    `<h1 ${SPLASH_HEADLINE_ATTR}="">${escapeHtml(heading)}</h1>` +
    `</div>`
  );
}

/** the splash: the mark and the headline on a fixed sheet of ink */
export function staticSplashMarkup(): string {
  return `<div ${STATIC_SPLASH_ATTR}="" style="${STATIC_SPLASH_LAYOUT}">${staticSplashSvg()}${staticSplashCopy()}</div>`;
}

/**
 * Drops the static splash before first paint when the intro will not play:
 * the session flag is set, or motion is reduced (shouldPlayIntro). Storage
 * that throws reads as "not played", as it does for the policy.
 */
export function staticSplashScript(): string {
  return (
    "(function(){var played=false,reduced=false;" +
    `try{played=sessionStorage.getItem(${JSON.stringify(INTRO_PLAYED_KEY)})!=null}catch(e){}` +
    `try{reduced=matchMedia(${JSON.stringify(REDUCED_MOTION_QUERY)}).matches}catch(e){}` +
    `if(played||reduced){var el=document.querySelector("[${STATIC_SPLASH_ATTR}]");if(el)el.remove()}})();`
  );
}

/** what vite's transformIndexHtml accepts (its HtmlTagDescriptor, without the import) */
export type StaticSplashTag = {
  tag: string;
  attrs?: Record<string, string>;
  children?: string;
  injectTo: "head" | "body-prepend";
};

/** the ink and the fallback faces in the head; the splash and its script at the top of the body, in that order */
export function staticSplashTags(): StaticSplashTag[] {
  return [
    { tag: "style", children: INLINE_HEAD_STYLE, injectTo: "head" },
    {
      tag: "div",
      attrs: { [STATIC_SPLASH_ATTR]: "", style: STATIC_SPLASH_LAYOUT },
      children: `${staticSplashSvg()}${staticSplashCopy()}`,
      injectTo: "body-prepend",
    },
    { tag: "script", children: staticSplashScript(), injectTo: "body-prepend" },
  ];
}
