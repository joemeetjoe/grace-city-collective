import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import GMark from "@/marks/GMark";
import { site } from "@/content/site";
import { HERO_HEADLINE_STYLE, HERO_KICKER_TO_HEADLINE, HERO_STOP_TOP } from "@/features/stops/heroMetrics";
import { FONT_FALLBACK_CSS } from "@/theme/fontFallback";
import { FONT_SANS, FONT_SERIF } from "@/theme/fonts";
import { tokens } from "@/theme/tokens";
import { REDUCED_MOTION_QUERY } from "../../device/reducedMotion";
import { INTRO_PLAYED_KEY } from "./introKeys";
import { SPLASH_COMPOSITION, SPLASH_COMPOSITIONS, SPLASH_HEADLINE } from "./splashComposition";
import { SPLASH_MARK_SIZE } from "./splashMark";
import {
  INLINE_HEAD_STYLE,
  LIVE_SPLASH_ATTR,
  SPLASH_COPY_ATTR,
  SPLASH_HEADLINE_ATTR,
  SPLASH_KICKER_ATTR,
  SPLASH_LAYOUT_CSS,
  STATIC_SPLASH_ATTR,
  STATIC_SPLASH_LAYOUT,
  STATIC_SPLASH_STYLE,
  staticSplashCopy,
  staticSplashMarkup,
  staticSplashScript,
  staticSplashSvg,
  staticSplashTags,
} from "./staticSplash";
import { removeStaticSplash } from "./staticSplashDom";

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html").body;
const svgOf = (html: string) => parse(html).querySelector("svg")!;
const paths = (svg: SVGSVGElement) => [...svg.querySelectorAll("path")].map((p) => p.getAttribute("d"));

afterEach(() => {
  document.body.innerHTML = "";
  window.sessionStorage.clear();
});

describe("staticSplashSvg", () => {
  it("is the splash's own GMark: same viewBox, same paths, same size", () => {
    const stat = svgOf(staticSplashSvg());
    const live = svgOf(renderToStaticMarkup(<GMark size={SPLASH_MARK_SIZE} ruled decorative />));
    expect(stat.getAttribute("viewBox")).toBe(live.getAttribute("viewBox"));
    expect(paths(stat)).toEqual(paths(live));
    expect(stat.getAttribute("style")).toBe(live.getAttribute("style"));
    expect(stat.getAttribute("aria-hidden")).toBe("true");
    // and GMark's hooks: the live splash adopts this element and traces this rule
    expect(stat.hasAttribute("data-g-mark")).toBe(true);
    expect(stat.querySelector("path")!.hasAttribute("data-g-mark-rule")).toBe(true);
  });

  it("starts with the rule undrawn, in the seal's red, on a unit length", () => {
    const rule = svgOf(staticSplashSvg()).querySelector("path")!;
    expect(rule.getAttribute("pathLength")).toBe("1");
    expect(rule.getAttribute("stroke-dasharray")).toBe("1");
    expect(rule.getAttribute("stroke-dashoffset")).toBe("1");
    expect(rule.getAttribute("stroke")).toBe(tokens.seal);
  });

  it("paints in the tokens themselves, not CSS variables — no stylesheet has arrived yet", () => {
    expect(staticSplashSvg()).not.toContain("var(");
    expect(staticSplashMarkup()).not.toContain("var(");
    expect(STATIC_SPLASH_STYLE).toContain(`html{background:${tokens.ink}}`);
    expect(STATIC_SPLASH_STYLE).toContain(`body{margin:0;background:${tokens.ink}}`);
  });
});

describe("staticSplashMarkup", () => {
  it("lays the mark on a fixed sheet of ink, marked for removal", () => {
    const root = parse(staticSplashMarkup()).firstElementChild as HTMLElement;
    expect(root.hasAttribute(STATIC_SPLASH_ATTR)).toBe(true);
    expect(root.style.position).toBe("fixed");
    expect(root.style.inset).toBe("0px");
    expect(root.style.display).toBe("flex");
    expect(root.querySelector("svg")).not.toBeNull();
  });

  it("carries the hero headline from the site content in one h1, after the mark", () => {
    expect(SPLASH_HEADLINE).toBe(true);
    const root = parse(staticSplashMarkup()).firstElementChild as HTMLElement;
    const h1s = root.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(h1s[0].hasAttribute(SPLASH_HEADLINE_ATTR)).toBe(true);
    expect(h1s[0].textContent).toBe(site.scene[0].heading);
    // in the hero's block, under the kicker's stand-in
    const copy = h1s[0].parentElement!;
    expect(copy.hasAttribute(SPLASH_COPY_ATTR)).toBe(true);
    const kicker = h1s[0].previousElementSibling!;
    expect(kicker.hasAttribute(SPLASH_KICKER_ATTR)).toBe(true);
    expect(kicker.textContent).toBe(site.scene[0].kicker);
    // the mark first: the headline's block is positioned over it, not laid out beside it
    expect(root.firstElementChild!.tagName.toLowerCase()).toBe("svg");
  });

  it("without the headline in the composition, the splash is the mark alone", () => {
    expect(SPLASH_COMPOSITIONS.markOnly.headline).toBe(false);
    // the copy is the one thing the composition switches off; the mark stays
    expect(staticSplashCopy()).not.toBe("");
    expect(staticSplashMarkup()).toContain(staticSplashSvg());
  });
});

describe("SPLASH_LAYOUT_CSS", () => {
  /** the declarations of each rule with exactly this selector, in order */
  const rules = (css: string, selector: string): string[] =>
    css.split(`${selector}{`).slice(1).map((rest) => rest.slice(0, rest.indexOf("}")));

  it("sets the headline in the hero's box and type, in the serif stack itself, before any stylesheet", () => {
    const [headline] = rules(SPLASH_LAYOUT_CSS, `[${SPLASH_HEADLINE_ATTR}]`);
    expect(headline).toContain(`font-family:${FONT_SERIF}`);
    expect(headline).toContain(`font-size:${HERO_HEADLINE_STYLE.size}`);
    expect(headline).toContain(`line-height:${HERO_HEADLINE_STYLE.lineHeight}`);
    expect(headline).toContain(`letter-spacing:${HERO_HEADLINE_STYLE.tracking}`);
    expect(headline).toContain(`max-width:${HERO_HEADLINE_STYLE.measure}`);
    expect(headline).toContain("text-wrap:pretty");
    // the UA's h1 must not show through: bold, 2em, margins
    expect(headline).toContain("font-weight:400");
    expect(headline).toContain(`margin:${HERO_KICKER_TO_HEADLINE} 0 0`);
    // the lg size follows in its media query
    expect(SPLASH_LAYOUT_CSS).toContain(`@media (min-width: 1024px){[${SPLASH_HEADLINE_ATTR}]{font-size:${HERO_HEADLINE_STYLE.sizeLg}}}`);
    const [copy] = rules(SPLASH_LAYOUT_CSS, `[${SPLASH_COPY_ATTR}]`);
    expect(copy).toContain(`padding:${HERO_STOP_TOP} clamp(20px,4.4vw,60px) 0`);
    expect(copy).toContain(`color:${tokens.cream}`);
    expect(SPLASH_LAYOUT_CSS).toContain(`@media (max-width: 1023.98px){[${SPLASH_COPY_ATTR}]{padding-left:32px;padding-right:32px}}`);
  });

  it("lays the kicker's stand-in out unseen, in the kicker's own type, so the headline sits under its lines", () => {
    const [kicker] = rules(SPLASH_LAYOUT_CSS, `[${SPLASH_KICKER_ATTR}]`);
    expect(kicker).toContain("visibility:hidden");
    expect(kicker).toContain(`font-family:${FONT_SANS}`);
    expect(kicker).toContain("font-size:11px");
    expect(kicker).toContain("line-height:1.5");
    expect(kicker).toContain("letter-spacing:0.28em");
    expect(kicker).toContain("text-transform:uppercase");
    expect(kicker).toContain("margin:0");
  });

  it("lays both splash roots out by the composition, from lg up and below", () => {
    const both = `[${STATIC_SPLASH_ATTR}],[${LIVE_SPLASH_ATTR}]`;
    expect(SPLASH_LAYOUT_CSS).toContain(`${both}{${SPLASH_COMPOSITION.layout}}`);
    expect(SPLASH_LAYOUT_CSS).toContain(`@media (max-width: 1023.98px){${both}{${SPLASH_COMPOSITION.layoutBelowLg}}}`);
    expect(SPLASH_LAYOUT_CSS).not.toContain("var(");
  });
});

describe("staticSplashScript", () => {
  const run = () => new Function(staticSplashScript())();
  const mount = () => document.body.insertAdjacentHTML("afterbegin", staticSplashMarkup());
  const present = () => document.querySelector(`[${STATIC_SPLASH_ATTR}]`) !== null;

  it("leaves the splash for a fresh session", () => {
    mount();
    run();
    expect(present()).toBe(true);
  });

  it("drops it for a session that already played the intro, by the policy's own key", () => {
    mount();
    window.sessionStorage.setItem(INTRO_PLAYED_KEY, "1");
    run();
    expect(present()).toBe(false);
  });

  it("drops it under reduced motion, by the policy's own query", () => {
    mount();
    const original = window.matchMedia;
    window.matchMedia = ((query: string) =>
      ({ matches: query === REDUCED_MOTION_QUERY, media: query })) as unknown as typeof window.matchMedia;
    try {
      run();
    } finally {
      window.matchMedia = original;
    }
    expect(present()).toBe(false);
  });

  it("copes with no splash to drop", () => {
    window.sessionStorage.setItem(INTRO_PLAYED_KEY, "1");
    expect(run).not.toThrow();
  });
});

describe("staticSplashTags", () => {
  it("puts the ink and the fallback faces in the head, then the splash and its script at the top of the body, in that order", () => {
    const tags = staticSplashTags();
    expect(tags.map((t) => [t.tag, t.injectTo])).toEqual([
      ["style", "head"],
      ["div", "body-prepend"],
      ["script", "body-prepend"],
    ]);
    expect(tags[0].children).toBe(INLINE_HEAD_STYLE);
    // the ink first, then the faces, then the splash's layout: all before any text can paint
    expect(INLINE_HEAD_STYLE).toBe(`${STATIC_SPLASH_STYLE}${FONT_FALLBACK_CSS}${SPLASH_LAYOUT_CSS}`);
    expect(INLINE_HEAD_STYLE).toContain('@font-face{font-family:"Cormorant Garamond Fallback"');
    // the tag is the markup, attribute for attribute: the layout rides on it too
    const fromMarkup = parse(staticSplashMarkup()).firstElementChild as HTMLElement;
    expect(tags[1].attrs).toEqual(Object.fromEntries([...fromMarkup.attributes].map((a) => [a.name, a.value])));
    expect(tags[1].attrs).toMatchObject({ [STATIC_SPLASH_ATTR]: "", style: STATIC_SPLASH_LAYOUT });
    expect(tags[1].children).toBe(`${staticSplashSvg()}${staticSplashCopy()}`);
    expect(tags[2].children).toBe(staticSplashScript());
  });
});

describe("removeStaticSplash", () => {
  it("takes the splash out, and is a no-op without one", () => {
    document.body.insertAdjacentHTML("afterbegin", staticSplashMarkup());
    removeStaticSplash();
    expect(document.querySelector(`[${STATIC_SPLASH_ATTR}]`)).toBeNull();
    expect(() => removeStaticSplash()).not.toThrow();
  });
});
