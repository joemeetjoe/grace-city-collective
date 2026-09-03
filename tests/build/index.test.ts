import { describe, expect, it } from "vitest";

import { site } from "../../src/content/site";
import { FONT_SERIF } from "../../src/theme/fonts";
import { distIndexHtml } from "./dist";
import {
  blockingStylesheets,
  headOf,
  inlineStylePrecedesHeadScripts,
  splashPrecedesBodyScripts,
  staticSplashHeadlines,
  withoutNoscript,
} from "./splashOrder";

describe("dist/index.html", () => {
  it("puts the static splash on screen before any body script runs", () => {
    // The splash is the first element in <body>; every <script> in the body
    // (its own reset, anything later) follows it. Scripts in <head> paint
    // nothing, so the first paint is the splash whatever they do.
    expect(splashPrecedesBodyScripts(distIndexHtml())).toBe(true);
  });

  it("has no render-blocking stylesheet: the link is a preload, the stylesheet link only in a noscript", () => {
    const html = distIndexHtml();
    expect(blockingStylesheets(html)).toEqual([]);
    expect(html).toMatch(/<link rel="preload" as="style" crossorigin href="[^"]+\.css" onload="this\.onload=null;this\.rel='stylesheet'">/);
    expect(html).toMatch(/<noscript><link rel="stylesheet" crossorigin href="[^"]+\.css"><\/noscript>/);
  });

  it("carries the ink the splash needs in an inline head style, before any script", () => {
    expect(inlineStylePrecedesHeadScripts(distIndexHtml())).toBe(true);
  });

  it("stands the hero heading from the site content in one h1 in the static splash, before any script (#107)", () => {
    const html = distIndexHtml();
    expect(staticSplashHeadlines(html)).toEqual([site.scene[0].heading]);
    // set in the serif stack itself from the inline head style, so it paints in the hero's face (or its metric-matched fallback) at once
    const style = (withoutNoscript(headOf(html)).match(/<style\b[^>]*>([\s\S]*?)<\/style>/gi) ?? []).join("");
    const rule = /\[data-splash-headline\]\{([^}]*)\}/.exec(style);
    expect(rule?.[1]).toContain(`font-family:${FONT_SERIF}`);
  });
});
