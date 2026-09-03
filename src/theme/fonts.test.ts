import { readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";

import { FONT_FALLBACKS } from "./fontFallback";
import { FONT_SANS, FONT_SERIF } from "./fonts";

const indexCss = readFileSync(join(__dirname, "../index.css"), "utf8");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css|json)$/.test(p)) out.push(p);
  }
  return out;
}

describe("font stacks", () => {
  it("are what index.css declares for Tailwind's font-sans and font-serif", () => {
    expect(indexCss).toContain(`--font-sans: ${FONT_SANS};`);
    expect(indexCss).toContain(`--font-serif: ${FONT_SERIF};`);
  });

  it("name each metric-matched fallback right after its web font, then the local face it is drawn over", () => {
    const [sans, serif] = FONT_FALLBACKS;
    expect(FONT_SANS).toMatch(new RegExp(`^'Geist Variable', '${sans.fallbackFamily}', ${sans.localFamily},`));
    expect(FONT_SERIF).toMatch(new RegExp(`^'Cormorant Garamond', '${serif.fallbackFamily}', ${serif.localFamily},`));
  });

  it("are the only font-family lists in src/ that name a web font: everything else uses font-sans, font-serif or the token", () => {
    // an arbitrary [font-family:'Cormorant_Garamond',…] class, or a quoted family in a
    // style, would set the web font without its fallback face behind it
    const own = new Set(["fonts.ts", "fonts.test.ts", "index.css"]);
    const offenders = walk(join(__dirname, ".."))
      .filter((p) => !own.has(basename(p)))
      .filter((p) => /'(Cormorant[ _]Garamond|Geist[ _]Variable)'/.test(readFileSync(p, "utf8")));
    expect(offenders).toEqual([]);
  });
});
