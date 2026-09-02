import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { TIER_NARROW_WIDTH } from "@/device/tierPolicy";
import { BELOW_LG_QUERY, belowLg } from "@/layout/breakpoint";
import { LG_PX } from "./breakpoints";

const indexCss = readFileSync(join(__dirname, "../index.css"), "utf8");

describe("the lg breakpoint", () => {
  it("is Tailwind's own lg, 64rem at the 16px root, which index.css leaves as it is", () => {
    expect(LG_PX).toBe(64 * 16);
    expect(indexCss).not.toMatch(/--breakpoint-lg/);
  });

  it("is the one number the layout switch and the asset tier both key on", () => {
    expect(TIER_NARROW_WIDTH).toBe(LG_PX);
    expect(belowLg(LG_PX)).toBe(false);
    expect(belowLg(LG_PX - 1)).toBe(true);
    expect(BELOW_LG_QUERY).toBe(`(max-width: ${LG_PX - 0.02}px)`);
  });

  it("is written nowhere else: index.css uses Tailwind's max-lg variant, the script imports LG_PX", () => {
    // a bare 1024 (or the 1023.98 of a max-width query) outside breakpoints.ts;
    // the texture tiers' "1024" plate width is a different number, quoted
    const bare = /(?<!["'\d.])10(?:24|23\.98)(?!["'\d])/;
    expect(indexCss).not.toMatch(bare);
    for (const file of ["../layout/breakpoint.ts", "../device/tierPolicy.ts", "./classes.ts", "./motion.ts"]) {
      expect(readFileSync(join(__dirname, file), "utf8"), file).not.toMatch(bare);
    }
  });
});
