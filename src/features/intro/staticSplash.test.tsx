import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import GMark from "@/marks/GMark";
import { FONT_FALLBACK_CSS } from "@/theme/fontFallback";
import { tokens } from "@/theme/tokens";
import { REDUCED_MOTION_QUERY } from "../../device/reducedMotion";
import { INTRO_PLAYED_KEY } from "./introKeys";
import { SPLASH_MARK_SIZE } from "./splashMark";
import {
  INLINE_HEAD_STYLE,
  STATIC_SPLASH_ATTR,
  STATIC_SPLASH_LAYOUT,
  STATIC_SPLASH_STYLE,
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
  it("centres the mark on a fixed sheet of ink, marked for removal", () => {
    const root = parse(staticSplashMarkup()).firstElementChild as HTMLElement;
    expect(root.hasAttribute(STATIC_SPLASH_ATTR)).toBe(true);
    expect(root.style.position).toBe("fixed");
    expect(root.style.inset).toBe("0px");
    expect(root.style.display).toBe("flex");
    expect(root.querySelector("svg")).not.toBeNull();
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
    // the ink first, then the faces: both before any text can paint
    expect(INLINE_HEAD_STYLE).toBe(`${STATIC_SPLASH_STYLE}${FONT_FALLBACK_CSS}`);
    expect(INLINE_HEAD_STYLE).toContain('@font-face{font-family:"Cormorant Garamond Fallback"');
    // the tag is the markup, attribute for attribute: the layout rides on it too
    const fromMarkup = parse(staticSplashMarkup()).firstElementChild as HTMLElement;
    expect(tags[1].attrs).toEqual(Object.fromEntries([...fromMarkup.attributes].map((a) => [a.name, a.value])));
    expect(tags[1].attrs).toMatchObject({ [STATIC_SPLASH_ATTR]: "", style: STATIC_SPLASH_LAYOUT });
    expect(tags[1].children).toBe(staticSplashSvg());
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
