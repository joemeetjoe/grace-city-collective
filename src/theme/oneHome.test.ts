import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The theme is the one home for the site's shared visual constants (#116):
 * colours (tokens.ts), font stacks (fonts.ts), motion (motion.ts), the lg
 * breakpoint (breakpoints.ts), the shared measures (measures.ts) and the
 * Tailwind bundles (classes.ts). No
 * other module under src exports a timing constant or a Tailwind class
 * string, and the curve, the recurring measures and the breakpoint are each
 * written once. SVG geometry and CSS lengths (a bracket's arm, the lockup's
 * size, a selector) are not Tailwind and are left alone.
 */

const SRC = join(__dirname, "..");
const THEME = __dirname;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(p) && !/\.test\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const outsideTheme = files.filter((p) => !p.startsWith(THEME));
const rel = (p: string) => relative(SRC, p);

/** an exported string constant on one line: `export const NAME = "…";` */
const EXPORTED_STRING = /^export const (\w+)(?::\s*string)?\s*=\s*(["'`])((?:(?!\2)[^\n])*)\2;?\s*$/gm;

/** a Tailwind utility, by its root, with any variants and value */
const UTILITY =
  /^(?:[\w[\]@():.=%-]+:)*-?(?:flex|grid|block|hidden|inline|relative|absolute|fixed|sticky|p[xytblr]?|m[xytblr]?|gap|text|font|tracking|leading|bg|border|rounded|w|h|min-h|max-w|inset|top|left|right|bottom|z|opacity|transition|duration|ease|uppercase|items|justify|self|shrink|overflow|outline|ring|cursor|scale|translate|origin|backdrop|scroll-mt)(?:-[^\s]+)?$/;

function looksTailwind(literal: string): boolean {
  const words = literal.split(/\s+/).filter(Boolean);
  const utilities = words.filter((w) => UTILITY.test(w));
  // two utilities, or one carrying a variant or an arbitrary value
  return utilities.length >= 2 || utilities.some((w) => /[:[]/.test(w));
}

describe("one home for the theme", () => {
  it("has no barrel: the engine is the repo's only index", () => {
    expect(readdirSync(THEME)).not.toContain("index.ts");
  });

  it("is the only place a *_MS, *_SECONDS or *_EASE constant is exported from", () => {
    const strays = outsideTheme.flatMap((p) =>
      [...readFileSync(p, "utf8").matchAll(/^export const (\w+(?:_MS|_SECONDS|_EASE))\b/gm)].map((m) => `${rel(p)}: ${m[1]}`),
    );
    expect(strays).toEqual([]);
  });

  it("is the only place a Tailwind class string is exported from", () => {
    const strays = outsideTheme.flatMap((p) =>
      [...readFileSync(p, "utf8").matchAll(EXPORTED_STRING)]
        .filter((m) => looksTailwind(m[3]))
        .map((m) => `${rel(p)}: ${m[1]}`),
    );
    expect(strays).toEqual([]);
  });

  it("writes the curve, the recurring measures and the breakpoint once", () => {
    const count = (re: RegExp) =>
      files.map((p) => [rel(p), (readFileSync(p, "utf8").match(re) ?? []).length] as const).filter(([, n]) => n > 0);
    expect(count(/cubic-bezier\(/g)).toEqual([["index.css", 1]]);
    expect(count(/clamp\(\s*9px,\s*2\.4vw,\s*26px\s*\)/g)).toEqual([["index.css", 1]]);
    expect(count(/clamp\(\s*20px,\s*4\.4vw,\s*60px\s*\)/g)).toEqual([["index.css", 1]]);
    expect(count(/clamp\(\s*18px,\s*2\.6vw,\s*32px\s*\)/g)).toEqual([["index.css", 1]]);
    expect(count(/clamp\(\s*22px,\s*4\.2vw,\s*52px\s*\)/g)).toEqual([["index.css", 1]]);
    // the breakpoint; the texture tiers' 1024px plate width is a different number, in the tier modules
    const plate = /^device\/(tier|textureManifest|tierPreload)\.ts$/;
    expect(count(/(?<!["'\d.])1024(?!["'\d])/g).filter(([p]) => !plate.test(p))).toEqual([["theme/breakpoints.ts", 1]]);
  });

  it("keeps the folded modules gone", () => {
    for (const gone of ["app/styles.ts", "theme/glass.ts", "theme/interact.ts", "features/stops/tuck.ts"]) {
      expect(files.map(rel)).not.toContain(gone);
    }
  });
});
