import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { STACK } from "@/components/layerSplit";
import { sectionIds, site } from "@/content/site";
import { HANDOFF_Z_INDEX } from "@/intro/handoff";
import { INTRO_PLAYED_KEY, REDUCED_MOTION_QUERY } from "@/intro/introPolicy";
import { STATIC_SPLASH_ATTR, staticSplashMarkup } from "@/intro/staticSplash";
import { installScrollDriver, type ScrollDriver } from "@/scroll/position";

// jsdom cannot probe for WebGL; each test says whether it is there
const seams = vi.hoisted(() => ({ webgl: true }));
vi.mock("@/scene/fallback", async (orig) => ({
  ...(await orig<typeof import("@/scene/fallback")>()),
  detectWebgl: () => seams.webgl,
}));

// the smoother runs for real; the hook's arguments are recorded so a test can
// see which layers it was asked to hold
const smoother = vi.hoisted(() => ({
  calls: [] as Array<{ held: Array<{ current: HTMLElement | null }> }>,
}));
vi.mock("@/scroll/useSmoothScroll", async (orig) => {
  const mod = await orig<typeof import("@/scroll/useSmoothScroll")>();
  return {
    ...mod,
    useSmoothScroll: (
      refs: Parameters<typeof mod.useSmoothScroll>[0],
      reduced: boolean,
    ) => {
      smoother.calls.push({ held: refs.held });
      return mod.useSmoothScroll(refs, reduced);
    },
  };
});

// WebGL does not exist in jsdom: stand in for the scene and report ready at once
vi.mock("@/components/PentecostParallax", async () => {
  const { useEffect } = await import("react");
  function ParallaxStub({ onReady }: { onReady?: () => void }) {
    useEffect(() => onReady?.(), [onReady]);
    return <div data-parallax-stub="" />;
  }
  return { default: ParallaxStub };
});

function stubFontSize(px: number) {
  const real = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((el, pseudo) => {
    const style = real(el, pseudo);
    if ((el as HTMLElement).dataset?.lockup === "wordmark") {
      Object.defineProperty(style, "fontSize", {
        value: `${px}px`,
        configurable: true,
      });
    }
    return style;
  });
}

function preferReducedMotion() {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query === REDUCED_MOTION_QUERY,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
  stubFontSize(120);
  seams.webgl = true;
});
afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  installScrollDriver(null);
});

describe("App intro policy", () => {
  it("a fresh session renders the splash over the hero", () => {
    const { container } = render(<App />);
    expect(container.querySelector("[data-intro-splash]")).not.toBeNull();
    expect(container.querySelector("[data-hero-lockup]")).not.toBeNull();
  });

  it("a session that already played the intro renders no splash", () => {
    window.sessionStorage.setItem(INTRO_PLAYED_KEY, "1");
    const { container } = render(<App />);
    expect(container.querySelector("[data-intro-splash]")).toBeNull();
    expect(container.querySelector("[data-hero-lockup]")).not.toBeNull();
  });

  it("a session that already played the intro drops the static splash from index.html", () => {
    window.sessionStorage.setItem(INTRO_PLAYED_KEY, "1");
    document.body.insertAdjacentHTML("afterbegin", staticSplashMarkup());
    render(<App />);
    expect(document.querySelector(`[${STATIC_SPLASH_ATTR}]`)).toBeNull();
  });

  it("reduced motion renders no splash and fades the parallax up from ink", () => {
    preferReducedMotion();
    const { container } = render(<App />);
    expect(container.querySelector("[data-intro-splash]")).toBeNull();
    expect(container.querySelector("[data-hero-lockup]")).not.toBeNull();
    const parallax = container.querySelector("[data-parallax]") as HTMLElement;
    // the fade starts on ink the moment the page mounts
    expect(parseFloat(parallax.style.opacity)).toBeLessThan(1);
    // nothing played, so a later full-motion session still gets the intro
    expect(window.sessionStorage.getItem(INTRO_PLAYED_KEY)).toBeNull();
  });
});

describe("App hero seal", () => {
  it("is the stamp-replay button; the splash's seal is not", () => {
    const { container } = render(<App />);
    const hero = container.querySelector("[data-hero-lockup]")!;
    const button = hero.querySelector(
      'button[aria-label="Replay the seal stamp"]',
    )!;
    expect(button).not.toBeNull();
    const seal = button.querySelector('[data-lockup="seal"]')!;
    // live variant, resting with its overlay off
    expect(seal.querySelectorAll("filter").length).toBeGreaterThan(0);
    expect(
      (seal.querySelector('[data-seal="live"]') as SVGGElement).style.display,
    ).toBe("none");
    expect(container.querySelector("[data-intro-splash] button")).toBeNull();
  });
});

describe("App nav", () => {
  it("the nav carries the G mark at both breakpoints, linked to the top, and no seal", () => {
    const { container } = render(<App />);
    const marks = Array.from(container.querySelectorAll("nav [data-nav-mark] [data-g-mark]"));
    expect(marks.length).toBe(2);
    expect(marks.filter((m) => m.closest("[data-mobile-nav]")).length).toBe(1);
    for (const mark of marks) expect(mark.closest("a")?.getAttribute("href")).toBe("#hero");
    expect(container.querySelector("nav [data-seal]")).toBeNull();
  });

  it("the mobile nav sits in the same sticky nav as the desktop links", () => {
    const { container } = render(<App />);
    const mobile = container.querySelector("nav [data-mobile-nav]")!;
    expect(mobile).not.toBeNull();
    expect(mobile.querySelector("button")?.textContent).toBe("Menu");
  });
});

describe("App static fallback", () => {
  it("with WebGL and full motion the scene renders, not the poster", () => {
    const { container } = render(<App />);
    expect(
      container.querySelector("[data-parallax] [data-parallax-stub]"),
    ).not.toBeNull();
    expect(container.querySelector("[data-poster]")).toBeNull();
  });

  it("without WebGL the poster covers the scene container instead", () => {
    seams.webgl = false;
    const { container } = render(<App />);
    expect(container.querySelector("[data-parallax-stub]")).toBeNull();
    const img = container.querySelector("[data-parallax] [data-poster] img")!;
    expect(img.getAttribute("src")).toMatch(/dore-pentecost-dark-1280/);
  });

  it("under reduced motion the poster stands in and still fades up from ink", () => {
    preferReducedMotion();
    const { container } = render(<App />);
    expect(container.querySelector("[data-parallax-stub]")).toBeNull();
    expect(
      container.querySelector("[data-parallax] [data-poster]"),
    ).not.toBeNull();
    const parallax = container.querySelector("[data-parallax]") as HTMLElement;
    expect(parseFloat(parallax.style.opacity)).toBeLessThan(1);
  });

  it("under Save-Data the poster stands in", () => {
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true },
      configurable: true,
    });
    try {
      const { container } = render(<App />);
      expect(
        container.querySelector("[data-parallax] [data-poster]"),
      ).not.toBeNull();
    } finally {
      delete (navigator as { connection?: unknown }).connection;
    }
  });
});

describe("App content", () => {
  const facts = [
    "House Churches",
    "love feast",
    "10:30 a.m.",
    "first Sunday of each month",
    "12–20",
    "West Georgia",
    "lay elder/pastor",
    "104 West Perennial Drive",
    "#100",
    "Temple, GA 30179",
    "info@gracecitycollective.com",
    "tommy@gracecitycollective.com",
    // the six Core Devotions
    "Loving God and Loving Others",
    "Scriptures",
    "Community",
    "Prayer",
    "Sacrificial Generosity",
    "Intentional Missional Discipleship",
    // the ten What We Believe headings
    "God",
    "Jesus",
    "The Holy Spirit",
    "The Bible",
    "Human Beings",
    "Salvation",
    "Eternal Security",
    "The Church",
    "Eternity",
    "Ordinances",
    // latest messages
    "Why Does God Want Christians to Gather?",
    "All messages",
  ];

  it.each(facts)("renders %s", (fact) => {
    const { container } = render(<App />);
    expect(container.textContent).toContain(fact);
  });

  it("renders no placeholder copy and no personal gmail", () => {
    const { container } = render(<App />);
    for (const gone of [
      "Est. 2019",
      "123 Placeholder Ave",
      "Prayer at Dawn",
      "Midweek Table",
      "gmail.com",
    ]) {
      expect(container.textContent).not.toContain(gone);
    }
  });

  it("nav links jump through the scroll driver when one is installed", () => {
    const driver: ScrollDriver = { scrollTop: () => 0, scrollTo: vi.fn() };
    const { container } = render(<App />);
    // after the mount: the app installs its own smoother on mount, and the last one in wins
    installScrollDriver(driver);
    fireEvent.click(container.querySelector("nav a[href='#give']")!);
    expect(driver.scrollTo).toHaveBeenCalledTimes(1);
    expect(driver.scrollTo).toHaveBeenCalledWith(expect.any(Number), true);
  });

  it("nav links resolve to sections on the page", () => {
    const { container } = render(<App />);
    const links = Array.from(container.querySelectorAll("nav a[href^='#']"));
    expect(links.length).toBeGreaterThanOrEqual(8);
    for (const a of links) {
      const id = a.getAttribute("href")!.slice(1);
      expect(container.querySelector(`#${id}`), `#${id}`).not.toBeNull();
    }
  });
});

describe("App gatherings calendar", () => {
  it("the calendar sits in the gatherings panel and lights for the gathering under the pointer", () => {
    const { container } = render(<App />);
    const panel = container.querySelector("#gatherings [data-copy-panel]")!;
    const grid = panel.querySelector("[data-gathering-calendar]")!;
    expect(grid.getAttribute("data-lit")).toBeNull();
    const homes = panel.querySelector("[data-gathering=homes]")!;
    const feast = panel.querySelector("[data-gathering=feast]")!;
    fireEvent.mouseEnter(homes);
    expect(grid.getAttribute("data-lit")).toBe("homes");
    fireEvent.mouseLeave(homes);
    expect(grid.getAttribute("data-lit")).toBeNull();
    fireEvent.mouseEnter(feast);
    expect(grid.getAttribute("data-lit")).toBe("feast");
    // leaving one after entering the other does not put the lit one out
    fireEvent.mouseLeave(homes);
    expect(grid.getAttribute("data-lit")).toBe("feast");
  });
});

describe("App house churches table", () => {
  it("the table sits in the house churches panel and lights while the pointer is over the panel", () => {
    const { container } = render(<App />);
    const panel = container.querySelector("#house-churches [data-copy-panel]")!;
    const column = panel.querySelector("[data-house-churches-table]")!;
    const table = column.querySelector("[data-house-table]")!;
    expect(table.getAttribute("data-lit")).toBeNull();
    fireEvent.mouseEnter(panel);
    expect(table.getAttribute("data-lit")).toBe("");
    fireEvent.mouseLeave(panel);
    expect(table.getAttribute("data-lit")).toBeNull();
    // the words come first, the table after them, past the divider
    const kicker = panel.querySelector("p")!;
    expect(
      kicker.compareDocumentPosition(column) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("App shared life", () => {
  it("the program sits in the who-we-are panel and huddles while the pointer is over the panel", () => {
    const { container } = render(<App />);
    const panel = container.querySelector("#about [data-copy-panel]")!;
    const column = panel.querySelector("[data-about-shared-life]")!;
    const life = column.querySelector("[data-shared-life]")!;
    expect(life.getAttribute("data-lit")).toBeNull();
    fireEvent.mouseEnter(panel);
    expect(life.getAttribute("data-lit")).toBe("");
    fireEvent.mouseLeave(panel);
    expect(life.getAttribute("data-lit")).toBeNull();
    // the words come first, the program after them, past the divider
    const kicker = panel.querySelector("p")!;
    expect(
      kicker.compareDocumentPosition(column) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(container.querySelectorAll("[data-shared-life]")).toHaveLength(1);
  });
});

describe("App give sowing", () => {
  it("the sown field sits in the give panel alone and fills while the pointer is over the panel", () => {
    const { container } = render(<App />);
    const panel = container.querySelector("#give [data-copy-panel]")!;
    const field = panel.querySelector("[data-sowing-mark]")!;
    expect(field.getAttribute("data-lit")).toBeNull();
    fireEvent.mouseEnter(panel);
    expect(field.getAttribute("data-lit")).toBe("");
    fireEvent.mouseLeave(panel);
    expect(field.getAttribute("data-lit")).toBeNull();
    expect(container.querySelectorAll("[data-sowing-mark]")).toHaveLength(1);
  });
});

describe("App section markers", () => {
  it("the nav link and the rail dot agree on the current section", () => {
    const { container } = render(<App />);
    const rail = container.querySelector("[data-dot-rail]")!;
    expect(rail.querySelectorAll("a").length).toBe(sectionIds(site).length);
    const current = Array.from(
      container.querySelectorAll("[aria-current='location']"),
    );
    const ids = new Set(current.map((a) => a.getAttribute("href")));
    // one section: every current marker (nav link, rail dot) points at it
    expect(current.length).toBeGreaterThan(0);
    expect(ids.size).toBe(1);
    expect(rail.querySelector("[aria-current='location']")).not.toBeNull();
  });

  it("the rail sits outside the smoother's content, and its dots jump through the driver", () => {
    const driver: ScrollDriver = { scrollTop: () => 0, scrollTo: vi.fn() };
    const { container } = render(<App />);
    const rail = container.querySelector("[data-dot-rail]")!;
    expect(container.querySelector("#smooth-wrapper")!.contains(rail)).toBe(
      false,
    );
    installScrollDriver(driver);
    fireEvent.click(rail.querySelector("a[href='#faq']")!);
    expect(driver.scrollTo).toHaveBeenCalledWith(expect.any(Number), true);
  });
});

describe("App page structure", () => {
  it("the scene is exactly six labelled viewports, in order", () => {
    const { container } = render(<App />);
    const labels = Array.from(
      container.querySelectorAll("section[data-screen-label]"),
    ).map((s) => (s as HTMLElement).dataset.screenLabel);
    expect(labels).toEqual([
      "Hero",
      "Who we are",
      "House churches",
      "Gatherings",
      "Give",
      "Visit",
    ]);
  });

  it("the long-form sections carry no screen label and sit after the scene", () => {
    const { container } = render(<App />);
    const longform = container.querySelector("[data-longform]")!;
    expect(longform).not.toBeNull();
    expect(longform.querySelector("[data-screen-label]")).toBeNull();
    for (const id of ["devotions", "beliefs", "faq", "messages"]) {
      expect(longform.querySelector(`#${id}`), `#${id}`).not.toBeNull();
    }
    // the sticky scene wrapper ends before the long-form begins
    const scene = container.querySelector("[data-scene]")!;
    expect(scene.contains(container.querySelector("[data-parallax]"))).toBe(
      true,
    );
    expect(scene.contains(longform)).toBe(false);
    expect(
      scene.compareDocumentPosition(longform) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("the fixed layers sit outside the smoother's content; the scene and long-form inside it", () => {
    const { container } = render(<App />);
    const content = container.querySelector("#smooth-content")!;
    const wrapper = container.querySelector("#smooth-wrapper")!;
    expect(wrapper.contains(content)).toBe(true);
    expect(content.contains(container.querySelector("[data-scene]"))).toBe(
      true,
    );
    expect(content.contains(container.querySelector("[data-longform]"))).toBe(
      true,
    );
    // position: fixed does not survive a transformed ancestor
    expect(wrapper.contains(container.querySelector("nav"))).toBe(false);
    expect(
      wrapper.contains(container.querySelector("[data-intro-splash]")),
    ).toBe(false);
  });
});

describe("App canvas split", () => {
  const has = (el: Element | null, cls: string) =>
    !!el && el.classList.contains(cls);

  it("a front canvas sits in the scene above the hero headline, taking no pointer events", () => {
    const { container } = render(<App />);
    const front = container.querySelector("[data-parallax-front]")!;
    expect(front).not.toBeNull();
    expect(container.querySelector("[data-scene]")!.contains(front)).toBe(true);
    expect(front.querySelector("canvas")).not.toBeNull();
    expect(has(front, STACK.front)).toBe(true);
    expect(has(front, "pointer-events-none")).toBe(true);
    // the back canvas paints under everything
    expect(has(container.querySelector("[data-parallax]"), STACK.back)).toBe(
      true,
    );
  });

  it("the hero headline and the kicker rules sit between the canvases; the lockup rides above with the chrome", () => {
    const { container } = render(<App />);
    expect(
      container.querySelector("[data-hero-lockup]")!.closest(`.${STACK.copy}`),
    ).not.toBeNull();
    expect(has(container.querySelector("#hero h1"), STACK.between)).toBe(true);
    const rules = container.querySelectorAll(
      "section[data-screen-label] [data-kicker-rule]",
    );
    expect(rules.length).toBe(6);
    for (const rule of rules) expect(has(rule, STACK.between)).toBe(true);
  });

  it("every word a scene section says sits between the canvases: in its panel, or (the hero) on its own", () => {
    const { container } = render(<App />);
    const copy = container.querySelectorAll(
      "section[data-screen-label] :is(p, h1, h2, h3, a)",
    );
    expect(copy.length).toBeGreaterThan(10);
    for (const el of copy) {
      const section = el.closest("section")!;
      const between = el.closest(`.${STACK.between}`);
      expect(between, el.textContent ?? "").not.toBeNull();
      expect(section.contains(between)).toBe(true);
      // nothing in a section climbs back above the front canvas
      expect(el.closest(`.${STACK.copy}`), el.textContent ?? "").toBeNull();
    }
  });

  it("neither the scene, the sections nor their wrapper forms a stacking context of its own", () => {
    const { container } = render(<App />);
    const scene = container.querySelector("[data-scene]")!;
    const sections = scene.querySelectorAll("section[data-screen-label]");
    const wrapper = sections[0].parentElement!;
    for (const el of [scene, wrapper, ...sections]) {
      expect(
        [...el.classList].some((c) => /^z-/.test(c)),
        el.className,
      ).toBe(false);
    }
  });

  it("each sticky layer of the scene carries exactly one step of the stack (the smoother transforms them)", () => {
    const { container } = render(<App />);
    const scene = container.querySelector("[data-scene]")!;
    const layers = [...scene.children].filter((el) =>
      el.classList.contains("sticky"),
    );
    expect(layers.length).toBe(3);
    const steps = layers.map((el) =>
      [...el.classList].filter((c) => /^z-/.test(c)),
    );
    expect(steps).toEqual([[STACK.back], [STACK.front], [STACK.copy]]);
    expect(layers[2].querySelector("[data-hero-lockup]")).not.toBeNull();
    expect(layers[2].querySelector("[data-scene-frame]")).not.toBeNull();
  });

  it("the frame's square corners carry red brackets; each long-form section opens with a rule", () => {
    const { container } = render(<App />);
    const corners = container.querySelector(
      "[data-scene-frame] ~ [data-corner-ornaments]",
    )!;
    expect(corners).not.toBeNull();
    expect(corners.querySelectorAll("[data-ornate-rule]").length).toBe(4);
    expect(corners.className).toMatch(/text-seal/);
    // a phone's lockup sits in that corner, so the frame's brackets wait for md
    expect(corners.className).toMatch(/\bhidden\b/);
    expect(corners.className).toMatch(/md:block/);
    const sections = container.querySelectorAll("[data-longform] section");
    expect(sections.length).toBe(4);
    for (const section of sections)
      expect(section.querySelector('[data-ornate-rule="both"]')).not.toBeNull();
  });

  it("every scene stop but the hero brackets its copy the same way, under the front canvas", () => {
    const { container } = render(<App />);
    const stops = [...container.querySelectorAll("section[data-screen-label]")];
    expect(stops.length).toBe(6);
    for (const stop of stops) {
      const brackets = stop.querySelectorAll("[data-corner-ornaments]");
      if (stop.id === "hero") {
        expect(brackets.length).toBe(0);
        continue;
      }
      expect(brackets.length, stop.id).toBe(1);
      // the words sit inside a frosted-glass panel that the nearest figures cross
      const panel = brackets[0].parentElement!;
      expect(panel.getAttribute("data-copy-panel"), stop.id).not.toBeNull();
      expect(panel.classList.contains(STACK.between), stop.id).toBe(true);
      expect(panel.querySelector(`.${STACK.copy}`), stop.id).toBeNull();
      expect(panel.className, stop.id).toMatch(/bg-ink\/\d+/);
      expect(panel.className, stop.id).toMatch(/backdrop-blur/);
      expect(panel.querySelector("p, h2"), stop.id).not.toBeNull();
    }
  });

  it("the section links wear the copy panels' frosted glass in the nav; the bar itself does not", () => {
    const { container } = render(<App />);
    const nav = container.querySelector("nav")!;
    expect(nav.className).not.toMatch(/backdrop-blur-md/);
    const links = container.querySelector("nav [data-nav-links]")!;
    expect(links.className).toMatch(/backdrop-blur/);
    expect(links.className).toMatch(/bg-ink\/\d+/);
    // the dot rail's column of dots wears it too
    expect(
      container.querySelector("[data-dot-rail] [data-dot-glass]")!.className,
    ).toMatch(/backdrop-blur/);
  });

  it("the nav, the dot rail and the frame border stay above the front canvas", () => {
    const { container } = render(<App />);
    expect(
      container.querySelector("nav")!.closest(`.${STACK.nav}`),
    ).not.toBeNull();
    expect(has(container.querySelector("[data-dot-rail]"), STACK.nav)).toBe(
      true,
    );
    expect(
      container.querySelector("[data-scene-frame]")!.closest(`.${STACK.copy}`),
    ).not.toBeNull();
  });

  it("the smoother holds every sticky layer, the front canvas and the frame included", () => {
    const { container } = render(<App />);
    const call = smoother.calls.at(-1)!;
    const held = call.held.map((ref) => ref.current);
    for (const sel of ["[data-parallax]", "[data-parallax-front]"]) {
      expect(held, sel).toContain(container.querySelector(sel));
    }
    expect(held).toContain(
      container.querySelector("[data-hero-lockup]")!.parentElement,
    );
    expect(held).toContain(
      container.querySelector("[data-scene-frame]")!.parentElement,
    );
  });

  it("the splash's handoff sits over the headline and under the front canvas", () => {
    expect(HANDOFF_Z_INDEX).toBe(STACK.handoff);
  });

  it("the static poster renders no front canvas", () => {
    seams.webgl = false;
    const { container } = render(<App />);
    expect(container.querySelector("[data-parallax-front]")).toBeNull();
  });
});
