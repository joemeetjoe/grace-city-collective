import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { CSS_MEASURES, GUTTER, vwClamp } from "./measures";

const indexCss = readFileSync(join(__dirname, "../index.css"), "utf8");

describe("measure tokens", () => {
  it("declare each measure in index.css as --spacing-<name>, the clamp measures.ts holds", () => {
    for (const [name, [min, vw, max]] of Object.entries(CSS_MEASURES)) {
      const m = new RegExp(`--spacing-${name}:\\s*clamp\\(([^)]*)\\);`).exec(indexCss);
      expect(m, name).not.toBeNull();
      const parts = m![1].split(",").map((p) => p.trim());
      expect(parts, name).toEqual([`${min}px`, `${vw}vw`, `${max}px`]);
    }
  });

  it("name no measure in index.css that measures.ts does not hold", () => {
    const declared = [...indexCss.matchAll(/--spacing-([\w-]+):/g)].map((m) => m[1]);
    expect(declared.sort()).toEqual(Object.keys(CSS_MEASURES).sort());
  });

  it("write a measure as the clamp an inline style carries", () => {
    expect(vwClamp(GUTTER)).toBe("clamp(20px,4.4vw,60px)");
  });
});
