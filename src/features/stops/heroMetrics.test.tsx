import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { site } from "@/content/site";
import { LG_PX } from "@/theme/breakpoints";
import { gutter, kicker as kickerCls } from "@/theme/classes";
import { GUTTER, vwClamp } from "@/theme/measures";
import HeroStop from "./HeroStop";
import {
  BELOW_LG_QUERY,
  HERO_GUTTER,
  HERO_GUTTER_BELOW_LG,
  HERO_HEADLINE_STYLE,
  HERO_KICKER,
  HERO_KICKER_TO_HEADLINE,
  HERO_STOP_TOP,
  LG_QUERY,
} from "./heroMetrics";

const hero = site.scene[0];

describe("heroMetrics", () => {
  it("says what HeroStop's classes say: the stop's top, the gutters, the headline's type", () => {
    const { container } = render(<HeroStop section={hero} />);
    const section = container.querySelector("section")!;
    expect(section.className).toContain(`pt-[${HERO_STOP_TOP}]`);
    expect(section.className).toContain(gutter);
    // px-gutter reads --spacing-gutter (index.css); the splash writes the same clamp out (theme/measures.ts)
    expect(gutter).toBe("px-gutter");
    expect(HERO_GUTTER).toBe(vwClamp(GUTTER));
    expect(section.className).toContain("max-lg:px-8");
    expect(HERO_GUTTER_BELOW_LG).toBe("32px");
    const h1 = container.querySelector("h1")!;
    expect(h1.className).toContain(`text-[${HERO_HEADLINE_STYLE.size}]`);
    expect(h1.className).toContain(`lg:text-[${HERO_HEADLINE_STYLE.sizeLg}]`);
    expect(h1.className).toContain(`leading-[${HERO_HEADLINE_STYLE.lineHeight}]`);
    expect(h1.className).toContain(`tracking-[${HERO_HEADLINE_STYLE.tracking}]`);
    expect(h1.className).toContain(`max-w-[${HERO_HEADLINE_STYLE.measure}]`);
    expect(h1.className).toContain("text-pretty");
  });

  it("says what the kicker's classes say, and how far the headline sits under it", () => {
    expect(kickerCls).toContain(`text-[${HERO_KICKER.size}]`);
    expect(kickerCls).toContain(`tracking-[${HERO_KICKER.tracking}]`);
    expect(kickerCls).toContain("uppercase");
    const { container } = render(<HeroStop section={hero} />);
    // the kicker block: its rule 12px under the words (gap-3), 1px tall (h-px), then 22px to the headline
    const block = container.querySelector("h1")!.previousElementSibling as HTMLElement;
    expect(block.className).toContain("gap-3");
    expect(block.className).toContain("mb-[22px]");
    expect(block.querySelector("hr")!.className).toContain("h-px");
    expect(HERO_KICKER_TO_HEADLINE).toBe("35px");
  });

  it("writes Tailwind's lg as the same width the breakpoint hook uses", () => {
    expect(LG_QUERY).toBe(`(min-width: ${LG_PX}px)`);
    expect(BELOW_LG_QUERY).toBe(`(max-width: ${LG_PX - 0.02}px)`);
  });
});
