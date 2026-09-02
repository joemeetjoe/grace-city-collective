import { describe, expect, it } from "vitest";

import { distIndexHtml } from "./dist";
import { blockingStylesheets, inlineStylePrecedesHeadScripts, splashPrecedesBodyScripts } from "./splashOrder";

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
});
