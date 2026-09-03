import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { FONT_FALLBACK_CSS } from "../../src/theme/fontFallback";
import { distCss, distIndexHtml, distPath } from "./dist";
import { headOf, withoutNoscript } from "./splashOrder";

/** every `<link rel="preload" as="font">` in the head */
const fontPreloads = (html: string): string[] =>
  (withoutNoscript(headOf(html)).match(/<link\b[^>]*>/gi) ?? []).filter((tag) => /\bas="font"/.test(tag));

/** every inline <style> in the head, joined */
const inlineHeadStyle = (html: string): string =>
  (withoutNoscript(headOf(html)).match(/<style\b[^>]*>([\s\S]*?)<\/style>/gi) ?? []).join("");

describe("fonts in dist/index.html", () => {
  it("preloads the latin Cormorant Garamond 400 and Geist files, as font/woff2, anonymous", () => {
    const links = fontPreloads(distIndexHtml());
    expect(links).toHaveLength(2);
    expect(links[0]).toMatch(/href="\/assets\/cormorant-garamond-latin-400-normal-[\w-]+\.woff2"/);
    expect(links[1]).toMatch(/href="\/assets\/geist-latin-wght-normal-[\w-]+\.woff2"/);
    for (const link of links) {
      expect(link).toMatch(/\brel="preload"/);
      expect(link).toMatch(/\bas="font"/);
      expect(link).toMatch(/\btype="font\/woff2"/);
      expect(link).toMatch(/\bcrossorigin\b/);
    }
  });

  it("preloads the files the stylesheet's @font-face rules fetch, so each crosses the wire once", () => {
    const css = distCss();
    for (const link of fontPreloads(distIndexHtml())) {
      const href = /href="([^"]+)"/.exec(link)![1];
      expect(css).toContain(`url(${href})`);
      expect(existsSync(distPath(href.replace(/^\//, "")))).toBe(true);
    }
  });

  it("carries the metric-matched fallback faces in the inline head style, after the ink", () => {
    const style = inlineHeadStyle(distIndexHtml());
    expect(style).toContain(FONT_FALLBACK_CSS);
    expect(style).toMatch(
      /@font-face\{font-family:"Geist Fallback";src:local\("Arial"\);size-adjust:[\d.]+%;ascent-override:[\d.]+%;descent-override:[\d.]+%;line-gap-override:[\d.]+%\}/,
    );
    expect(style).toMatch(
      /@font-face\{font-family:"Cormorant Garamond Fallback";src:local\("Georgia"\);size-adjust:[\d.]+%;ascent-override:[\d.]+%;descent-override:[\d.]+%;line-gap-override:[\d.]+%\}/,
    );
    expect(style.indexOf("html{background:")).toBeLessThan(style.indexOf("@font-face"));
  });
});
