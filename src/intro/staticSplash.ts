/**
 * The splash as static markup, in index.html before any script runs: the G
 * mark on ink with its rule undrawn, so the page's first paint is the splash
 * and not bare ink waiting on the bundle. IntroSplash mounts over it with
 * the same geometry and removes it (staticSplashDom.ts); the inline script
 * removes it at once in a session the intro will not play in, mirroring
 * shouldPlayIntro, so a repeat visit never flashes the mark.
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
} from "../components/gMarkGeometry";
import { tokens } from "../theme/tokens";
import { REDUCED_MOTION_QUERY } from "../device/reducedMotion";
import { INTRO_PLAYED_KEY } from "./introKeys";
import { SPLASH_MARK_SIZE } from "./splashMark";

/** marks the static splash's root */
export const STATIC_SPLASH_ATTR = "data-intro-static";

/** the ink, on the document itself, before any stylesheet arrives */
export const STATIC_SPLASH_STYLE = `html{background:${tokens.ink}}`;

/** the ruled G mark, as GMark renders it for the splash: same viewBox, paths and size */
export function staticSplashSvg(): string {
  const vw = G_MARK_W + 2 * RULE_PAD;
  const vh = G_MARK_H + 2 * RULE_PAD;
  const size = SPLASH_MARK_SIZE;
  const style = `width:calc(${size} * ${gMarkAspect(true)});height:${size}`;
  const rule = gMarkBox(-RULE_GAP, RULE_CORNER);
  const mark = `${gMarkBox(0, G_MARK_CORNER)} ${G_MARK_LETTER}`;
  return (
    `<svg aria-hidden="true" viewBox="${-RULE_PAD} ${-RULE_PAD} ${vw} ${vh}" style="${style}">` +
    `<path d="${rule}" fill="none" stroke="${tokens.seal}" stroke-width="${RULE_WEIGHT}" ` +
    `pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"></path>` +
    `<path fill="${tokens.cream}" fill-rule="evenodd" d="${mark}"></path>` +
    `</svg>`
  );
}

/** the splash's root: a fixed sheet of ink with the mark centred on it, as IntroSplash lays it out */
export const STATIC_SPLASH_LAYOUT =
  "position:fixed;inset:0;z-index:50;display:flex;align-items:center;justify-content:center;" +
  `background:${tokens.ink}`;

/** the splash: the mark centred on a fixed sheet of ink */
export function staticSplashMarkup(): string {
  return `<div ${STATIC_SPLASH_ATTR}="" style="${STATIC_SPLASH_LAYOUT}">${staticSplashSvg()}</div>`;
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

/** the ink in the head; the splash and its script at the top of the body, in that order */
export function staticSplashTags(): StaticSplashTag[] {
  return [
    { tag: "style", children: STATIC_SPLASH_STYLE, injectTo: "head" },
    {
      tag: "div",
      attrs: { [STATIC_SPLASH_ATTR]: "", style: STATIC_SPLASH_LAYOUT },
      children: staticSplashSvg(),
      injectTo: "body-prepend",
    },
    { tag: "script", children: staticSplashScript(), injectTo: "body-prepend" },
  ];
}
