import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CSS_DURATIONS, EASE_SITE, EASE_SITE_POINTS } from "./motion";

const indexCss = readFileSync(join(__dirname, "../index.css"), "utf8");

describe("motion tokens", () => {
  it("declare the site's one easing curve in index.css as --ease-site, with the points motion.ts holds", () => {
    const m = /--ease-site:\s*cubic-bezier\(([^)]*)\);/.exec(indexCss);
    expect(m).not.toBeNull();
    const points = m![1].split(",").map((p) => Number(p.trim()));
    expect(points).toEqual([...EASE_SITE_POINTS]);
    expect(EASE_SITE).toBe("var(--ease-site)");
  });

  it("write the curve once: index.css names it, everything else reads the variable", () => {
    expect(indexCss.match(/cubic-bezier\(/g)).toHaveLength(1);
  });

  it("declare each duration in index.css as --duration-<name>, equal to the ms motion.ts holds", () => {
    for (const [name, ms] of Object.entries(CSS_DURATIONS)) {
      expect(indexCss, name).toContain(`--duration-${name}: ${ms}ms;`);
    }
  });

  it("name no duration in index.css that motion.ts does not hold", () => {
    const declared = [...indexCss.matchAll(/--duration-([\w-]+):/g)].map((m) => m[1]);
    expect(declared.sort()).toEqual(Object.keys(CSS_DURATIONS).sort());
  });

  it("leave no bare ms or s inside a transition or animation in index.css: each reads a token", () => {
    // the keyframe percentages and the media queries carry no durations; a
    // transition or animation shorthand names its duration by var()
    const shorthand = [...indexCss.matchAll(/^\s*(?:transition|animation|--animate-[\w-]+):([^;]*);/gms)].map((m) => m[1]);
    expect(shorthand.length).toBeGreaterThan(0);
    // a zero delay (var(--reveal-at, 0ms)) is no duration
    for (const value of shorthand) expect(value, value).not.toMatch(/(?:[1-9]\d*(?:\.\d+)?|0\.\d+)(?:ms|s)\b/);
  });
});
