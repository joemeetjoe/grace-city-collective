import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  BUTTON_CORNERS,
  BUTTON_LIFT,
  FOCUS_RING,
  GLASS,
  GLASS_CORNERS,
  LINK_SWEEP,
  LONGFORM_SECTION,
  ORNAMENT_IN_COLUMN,
  PHONE_BODY,
  STACK,
  STOP_COLUMN,
  TUCK,
  WORDS_BESIDE,
  between,
  button,
  gutter,
  kicker,
  longformContainer,
  longformHeading,
  ornamentColumn,
  panel,
  pill,
  serif,
  stackLevel,
  stopBody,
  stopFrame,
  stopHeading,
} from "./classes";

const indexCss = readFileSync(join(__dirname, "../index.css"), "utf8");

/**
 * The class list each caller wore before the bundles (#116), and what the
 * bundle now answers with. Two spellings changed on the way, both decided
 * in index.css and pinned below: four recurring clamp() measures became
 * `--spacing-*` tokens (`px-gutter` for `px-[clamp(20px,4.4vw,60px)]`, …),
 * and the short-viewport media query became the `short:` variant. Every
 * other class is byte-identical; a bundle may order its classes differently
 * from the string it replaced, which changes nothing in CSS.
 */
const TOKENS: Record<string, string> = {
  gutter: "clamp(20px,4.4vw,60px)",
  "frame-inset": "clamp(9px,2.4vw,26px)",
  "panel-pad": "clamp(18px,2.6vw,32px)",
  "lockup-foot": "clamp(22px,4.2vw,52px)",
};
const SHORT = "[@media(max-height:820px)]:";

/** the old class list, as the bundles now spell it */
function spelt(old: string): string {
  let s = old.replaceAll(SHORT, "short:");
  for (const [name, clamp] of Object.entries(TOKENS)) {
    s = s.replaceAll(`-[${clamp}]`, `-${name}`);
  }
  return s;
}

const classes = (s: string) => s.split(/\s+/).filter(Boolean).sort();

function expectSame(actual: string, old: string) {
  expect(actual).not.toMatch(/\s{2,}|^\s|\s$/);
  expect(classes(actual)).toEqual(classes(spelt(old)));
}

describe("the measures index.css tokenises", () => {
  it("are the clamp() values the classes wrote, declared once as --spacing-* and static, for the inline styles that read them", () => {
    const block = /@theme static \{([^}]*)\}/.exec(indexCss);
    expect(block).not.toBeNull();
    for (const [name, clamp] of Object.entries(TOKENS)) {
      const m = new RegExp(`--spacing-${name}:\\s*([^;]+);`).exec(block![1]);
      expect(m, name).not.toBeNull();
      expect(m![1].replace(/\s+/g, "")).toBe(clamp);
    }
  });

  it("include the short-viewport variant, ≤ 820px tall", () => {
    expect(indexCss).toContain("@custom-variant short (@media (max-height: 820px));");
  });
});

describe("stacking order", () => {
  it("runs back canvas, between, handoff, front canvas, copy, nav, cover, each a class whose number the script can read", () => {
    const steps = [STACK.back, STACK.between, STACK.handoff, STACK.front, STACK.copy, STACK.nav, STACK.cover];
    const levels = steps.map(stackLevel);
    expect(levels).toEqual([...levels].sort((a, b) => a - b));
    expect(new Set(levels).size).toBe(levels.length);
    expect(stackLevel(STACK.handoff)).toBe(15);
    expect(stackLevel(STACK.cover)).toBe(50);
    expect(between).toBe(`relative ${STACK.between}`);
  });
});

describe("the bundles answer with the class lists they replaced", () => {
  it("faces, measures, glass and manners", () => {
    expect(serif).toBe("font-serif");
    expectSame(gutter, "px-[clamp(20px,4.4vw,60px)]");
    expect(kicker).toBe("text-[11px] uppercase tracking-[0.28em] text-seal");
    expect(GLASS).toBe("bg-ink/15 backdrop-blur-md backdrop-saturate-125 border border-cream/10");
    expect(GLASS_CORNERS).toBe("rounded-tl-[clamp(14px,1.6vw,22px)] rounded-br-[clamp(14px,1.6vw,22px)]");
    expect(BUTTON_CORNERS).toBe("rounded-tl-[12px] rounded-br-[12px]");
    expect(FOCUS_RING).toBe(
      "outline-none focus-visible:ring-1 focus-visible:ring-cream/60 focus-visible:ring-offset-2 focus-visible:ring-offset-ink",
    );
    expect(LINK_SWEEP).toBe("link-sweep");
    expect(BUTTON_LIFT).toBe("btn-lift");
    expect(PHONE_BODY).toBe("max-lg:text-[14.5px] max-lg:leading-[1.6] max-lg:font-[380]");
  });

  it("the copy panel (Bracketed)", () => {
    expectSame(
      panel,
      "relative z-10 bg-ink/15 backdrop-blur-md backdrop-saturate-125 border border-cream/10 p-[clamp(18px,2.6vw,32px)] rounded-tl-[clamp(14px,1.6vw,22px)] rounded-br-[clamp(14px,1.6vw,22px)]",
    );
  });

  it("the calls to action (GiveStop, VisitStop, SiteNav)", () => {
    const seal = `${BUTTON_CORNERS} ${BUTTON_LIFT} ${FOCUS_RING} bg-seal text-cream hover:bg-seal-deep`;
    const ghost = `${BUTTON_CORNERS} ${BUTTON_LIFT} ${FOCUS_RING} border border-cream/45 [--lift-glow:var(--color-cream)] hover:border-cream hover:bg-cream/10`;
    expect(button({ intent: "seal", size: "cta" })).toBe(
      `${seal} px-[34px] py-4 text-xs font-bold uppercase tracking-[0.2em]`,
    );
    expect(button({ intent: "seal", size: "nav" })).toBe(
      `${seal} px-6 py-3 text-[11px] font-bold uppercase tracking-[0.18em]`,
    );
    expect(button({ intent: "ghost", size: "navHollow" })).toBe(
      `${ghost} px-[22px] py-[11px] text-[11px] uppercase tracking-[0.18em]`,
    );
  });

  it("the mobile nav's pills (MobileNav)", () => {
    const base = `${BUTTON_CORNERS} px-[22px] py-[13px] text-[11px] uppercase tracking-[0.18em] transition-colors`;
    expect(pill({ intent: "menu" })).toBe(`${base} ${GLASS} cursor-pointer text-cream/85 hover:text-cream`);
    expect(pill({ intent: "close" })).toBe(`${base} cursor-pointer text-cream/85 hover:text-cream`);
    expect(pill({ intent: "ghost" })).toBe(`${base} border border-cream/45 hover:border-cream hover:bg-cream/10`);
    expect(pill({ intent: "seal" })).toBe(`${base} bg-seal font-bold text-cream hover:bg-seal-deep`);
  });

  it("the stop headlines", () => {
    expectSame(
      stopHeading({ stop: "hero" }),
      "relative z-10 max-w-[7.155em] text-[clamp(42px,9vw,72px)] leading-[1.02] tracking-[-0.005em] text-pretty lg:text-[clamp(42px,5.6vw,84px)] font-serif",
    );
    expectSame(
      stopHeading({ stop: "about" }),
      "text-[clamp(30px,2.8vw,48px)] [@media(max-height:820px)]:lg:text-[36px] leading-[1.06] text-balance font-serif",
    );
    expectSame(stopHeading({ stop: "houses" }), "text-[clamp(34px,4.1vw,58px)] leading-[1.06] text-balance font-serif");
    expectSame(
      stopHeading({ stop: "gatherings" }),
      "text-[clamp(30px,3.4vw,48px)] leading-[1.06] text-balance [@media(max-height:820px)]:lg:text-[36px] font-serif",
    );
    expectSame(
      stopHeading({ stop: "give" }),
      "max-w-[20ch] text-[clamp(40px,5.2vw,76px)] leading-[1.04] text-balance [@media(max-height:820px)]:lg:text-[56px] font-serif",
    );
    expectSame(
      stopHeading({ stop: "visit" }),
      "max-w-[20ch] text-[clamp(36px,4.2vw,56px)] leading-[1.04] text-balance [@media(max-height:820px)]:lg:text-[42px] font-serif",
    );
  });

  it("the stop body copy", () => {
    const body = "text-base leading-relaxed text-pretty text-cream/80";
    expectSame(stopBody({ stop: "about" }), `${body} [@media(max-height:820px)]:lg:text-[14px] ${PHONE_BODY}`);
    expectSame(stopBody({ stop: "houses" }), `${body} md:text-lg ${PHONE_BODY}`);
    expectSame(
      stopBody({ stop: "give" }),
      `max-w-[52ch] ${body} md:text-lg lg:max-w-[38ch] min-[1440px]:max-w-[40ch] 2xl:max-w-[44ch] [@media(max-height:820px)]:lg:text-base ${PHONE_BODY}`,
    );
    expectSame(
      stopBody({ stop: "visit" }),
      `max-w-[52ch] ${body} md:text-lg [@media(max-height:820px)]:lg:text-base ${PHONE_BODY}`,
    );
  });

  it("the stop frames and tucks", () => {
    const frame = (holds: boolean) =>
      `relative flex ${holds ? "min-h-[100lvh]" : "lg:min-h-[100svh]"} px-[clamp(20px,4.4vw,60px)] max-lg:px-8`;
    const clear = "pt-[clamp(88px,11vh,110px)] pb-[clamp(72px,9vh,96px)] lg:py-0";
    for (const id of ["hero", "visit"] as const) {
      expectSame(stopFrame(id).base, frame(true));
      expect(stopFrame(id).clear).toBe(clear);
    }
    for (const id of ["about", "house-churches", "gatherings", "give"] as const) {
      expectSame(stopFrame(id).base, frame(false));
      expect(stopFrame(id).clear).toBe(clear);
    }
    expectSame(
      TUCK.about!,
      "lg:self-start lg:mt-[clamp(96px,12vh,140px)] lg:pl-[clamp(18px,2.6vw,32px)] lg:max-[1439px]:[--tuck:clamp(32px,calc(588px_-_22.7vw_+_4.8vh),320px)] min-[1440px]:ml-[clamp(24px,1.9vw,48px)] min-[1440px]:max-[1799px]:[--tuck:clamp(32px,calc(585px_-_20.8vw_+_4.8vh),340px)] min-[1800px]:[--tuck:clamp(32px,calc(505px_-_20.8vw_+_4.8vh),340px)]",
    );
    expect(TUCK.gatherings).toBe(
      "lg:self-start lg:mt-[clamp(96px,12vh,140px)] lg:[--tuck:clamp(120px,calc(58.8vw_-_63.6vh_-_60px),420px)] lg:pb-[clamp(40px,calc(30vh_-_200px),120px)] 2xl:max-w-[1200px]",
    );
    expect(TUCK.give).toBe("lg:translate-x-[clamp(120px,9.4vw,160px)] lg:px-[clamp(120px,9.4vw,160px)]");
    expect(TUCK["house-churches"]).toBeUndefined();
    expect(TUCK.visit).toBeUndefined();
  });

  it("the words beside a column ornament, and the column (#121)", () => {
    expect(STOP_COLUMN).toBe("flex flex-col gap-5 md:gap-[26px]");
    expect(WORDS_BESIDE).toBe("flex flex-col gap-5 md:gap-[26px] min-w-0 flex-1 md:pr-[clamp(24px,2.4vw,40px)]");
    const column =
      "relative mt-5 shrink-0 md:mt-0 md:w-[clamp(72px,20vw,120px)] md:border-l md:border-cream/25 md:pl-[clamp(20px,2vw,32px)]";
    expectSame(ornamentColumn({ ornament: "table" }), `${column} lg:w-[clamp(150px,12vw,200px)]`);
    expectSame(
      ornamentColumn({ ornament: "life" }),
      `${column} lg:w-[max(clamp(120px,9vw,160px),calc(var(--tuck)_-_var(--spacing-panel-pad)))]`,
    );
    expect(ORNAMENT_IN_COLUMN).toBe(
      "w-[clamp(72px,20vw,120px)] md:absolute md:inset-y-1 md:right-0 md:h-[calc(100%_-_8px)] md:w-[calc(100%_-_clamp(20px,2vw,32px))]",
    );
  });

  it("the long-form", () => {
    expectSame(
      LONGFORM_SECTION,
      "scroll-mt-24 px-[clamp(20px,4.4vw,60px)] py-[clamp(56px,9vh,140px)] md:py-[clamp(80px,12vh,140px)]",
    );
    expect(longformContainer).toBe("mx-auto flex max-w-[1080px] flex-col");
    expect(longformHeading).toBe("text-[clamp(34px,4.1vw,58px)] leading-[1.06] font-serif");
  });
});
