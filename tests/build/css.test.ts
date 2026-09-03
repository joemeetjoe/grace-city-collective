import { describe, expect, it } from "vitest";

import { distCss } from "./dist";

/** every @font-face block in the stylesheet */
const fontFaces = (css: string): string[] => css.match(/@font-face\{[^}]*\}/g) ?? [];

/** the latin subset's unicode-range as @fontsource writes it, ASCII first (`U+??` once minified) */
const LATIN_RANGE = /^U\+(0000-00FF|\?\?),/;

describe("the built stylesheet", () => {
  it("carries nothing of tw-animate-css", () => {
    const css = distCss();
    expect(css).not.toMatch(/@keyframes (enter|exit)\{/);
    expect(css).not.toContain("--tw-enter-");
    expect(css).not.toContain("--tw-exit-");
    expect(css).not.toContain("--tw-animation-");
  });

  it("still carries the mobile nav sheet's fade (src/features/nav/MobileNav.tsx)", () => {
    const css = distCss();
    expect(css).toMatch(/@keyframes sheet-in\{/);
    expect(css).toMatch(/@keyframes sheet-out\{/);
  });

  it("declares only latin font faces: the two families, one file each", () => {
    const faces = fontFaces(distCss());
    expect(faces).toHaveLength(2);
    for (const face of faces) {
      expect(face).toMatch(/url\(\/assets\/[a-z-]+-latin-[^)]+\.woff2\)/);
      expect(face).not.toMatch(/latin-ext|cyrillic|vietnamese|greek/);
      const range = /unicode-range:([^;}]+)/.exec(face)?.[1];
      if (range !== undefined) expect(range).toMatch(LATIN_RANGE);
    }
  });

  it("keeps the weights the site sets: variable Geist and Cormorant Garamond 400", () => {
    const faces = fontFaces(distCss());
    expect(faces.some((f) => f.includes("font-family:Geist Variable") && f.includes("font-weight:100 900"))).toBe(true);
    expect(faces.some((f) => f.includes("font-family:Cormorant Garamond") && f.includes("font-weight:400"))).toBe(true);
  });
});
