import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { STACK } from "@/theme/layerSplit";
import { sectionIds, site } from "@/content/site";
import { INTRO_PLAYED_KEY, REDUCED_MOTION_QUERY } from "@/features/intro/introPolicy";
import { STATIC_SPLASH_ATTR, staticSplashMarkup } from "@/features/intro/staticSplash";
import { BELOW_LG_QUERY } from "@/layout/breakpoint";
import { installScrollDriver, type ScrollDriver } from "@/scroll/position";

// jsdom cannot probe for WebGL; each test says whether it is there
const seams = vi.hoisted(() => ({ webgl: true }));
vi.mock("@/device/fallback", async (orig) => ({
  ...(await orig<typeof import("@/device/fallback")>()),
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
vi.mock("@/engine/PentecostParallax", async () => {
  const { useEffect } = await import("react");
  function ParallaxStub({ onReady }: { onReady?: () => void }) {
    useEffect(() => onReady?.(), [onReady]);
    return <div data-parallax-stub="" />;
  }
  return { default: ParallaxStub };
});

// the engine chunk is requested through the barrel's loader; count the requests
const engineLoads = vi.hoisted(() => ({ count: 0 }));
vi.mock("@/engine", async (orig) => {
  const mod = await orig<typeof import("@/engine")>();
  return {
    ...mod,
    loadParallax: () => {
      engineLoads.count += 1;
      return mod.loadParallax();
    },
  };
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

function matchOnly(...matching: string[]) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: matching.includes(query),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

const preferReducedMotion = () => matchOnly(REDUCED_MOTION_QUERY);
/** a phone or tablet: the viewport is below Tailwind's lg */
const belowLg = () => matchOnly(BELOW_LG_QUERY);

/**
 * the long-form wrapper once its chunk has filled the sections in (#111):
 * jsdom has no IntersectionObserver, so the gate asks for it at mount and
 * the words follow a tick later
 */
async function longformIn(container: HTMLElement): Promise<Element> {
  await waitFor(() => expect(container.querySelector("[data-longform] footer")).not.toBeNull());
  return container.querySelector("[data-longform]")!;
}

beforeEach(() => {
  engineLoads.count = 0;
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

describe("App hero lockup placement", () => {
  it("from lg up it is pinned in the sticky chrome, and the hero carries none", () => {
    const { container } = render(<App />);
    const lockups = container.querySelectorAll("[data-hero-lockup]");
    expect(lockups.length).toBe(1);
    expect(lockups[0].closest("section")).toBeNull();
    expect(lockups[0].parentElement!.classList.contains("sticky")).toBe(true);
    expect(lockups[0].className).toMatch(/\babsolute\b/);
  });

  it("below lg it sits at the hero's foot, above the front canvas, and the frame border stays in the sticky chrome", () => {
    belowLg();
    const { container } = render(<App />);
    const lockups = container.querySelectorAll("[data-hero-lockup]");
    expect(lockups.length).toBe(1);
    const lockup = lockups[0] as HTMLElement;
    const hero = container.querySelector("#hero")!;
    expect(hero.contains(lockup)).toBe(true);
    // the hero's last child, pushed to its foot
    expect(hero.lastElementChild).toBe(lockup);
    expect(lockup.className).toMatch(/\bmt-auto\b/);
    expect(lockup.classList.contains(STACK.copy)).toBe(true);
    expect(lockup.querySelector("[data-stacked]")).not.toBeNull();
    // nothing of it is left in the chrome; the frame is
    const frame = container.querySelector("[data-scene-frame]")!;
    expect(frame.parentElement!.classList.contains("sticky")).toBe(true);
    expect(frame.parentElement!.querySelector("[data-hero-lockup]")).toBeNull();
    // the hero clears the pinned lockup only where there is one
    expect(hero.className).toMatch(/lg:pb-\[/);
  });
});

describe("App frame height", () => {
  // dvh steps while a phone's URL bar animates; below lg the layer takes a
  // measured px height so its transition can glide between the steps
  it("below lg the frame layer wears a measured px height and a height transition", () => {
    belowLg();
    const { container } = render(<App />);
    const layer = container.querySelector("[data-scene-frame]")!.parentElement!;
    expect(layer.style.height).toBe(`${window.innerHeight}px`);
    expect(layer.className).toMatch(/transition-\[height\]/);
  });

  it("from lg up the dvh class stands alone, unmeasured", () => {
    const { container } = render(<App />);
    const layer = container.querySelector("[data-scene-frame]")!.parentElement!;
    expect(layer.style.height).toBe("");
    expect(layer.className).toMatch(/h-\[100dvh\]/);
  });
});

describe("App hero seal", () => {
  it("renders plain: the seal is artwork, not a button, in the hero and the splash alike", () => {
    const { container } = render(<App />);
    const hero = container.querySelector("[data-hero-lockup]")!;
    expect(hero.querySelector('[data-lockup="seal"]')).not.toBeNull();
    expect(hero.querySelector("button")).toBeNull();
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
  });
});

describe("App static fallback", () => {
  // React.lazy remembers the chunk once it has resolved, so the loader is
  // called once per module instance: these two render a fresh App
  const freshApp = async () => {
    vi.resetModules();
    return (await import("./App")).default;
  };

  it("with WebGL and full motion the scene renders, not the poster, once the engine chunk arrives", async () => {
    const FreshApp = await freshApp();
    const { container } = render(<FreshApp />);
    await waitFor(() =>
      expect(
        container.querySelector("[data-parallax] [data-parallax-stub]"),
      ).not.toBeNull(),
    );
    expect(container.querySelector("[data-poster]")).toBeNull();
    expect(engineLoads.count).toBe(1);
  });

  it("without WebGL the poster covers the scene container instead, and the engine chunk is never requested", async () => {
    seams.webgl = false;
    const FreshApp = await freshApp();
    const { container } = render(<FreshApp />);
    expect(container.querySelector("[data-parallax-stub]")).toBeNull();
    const img = container.querySelector("[data-parallax] [data-poster] img")!;
    expect(img.getAttribute("src")).toMatch(/dore-pentecost-dark-640\b.*\.webp$/);
    await new Promise((r) => setTimeout(r, 20));
    expect(engineLoads.count).toBe(0);
  });

  it("under reduced motion the poster stands in and still fades up from ink", () => {
    preferReducedMotion();
    const { container } = render(<App />);
    expect(container.querySelector("[data-parallax-stub]")).toBeNull();
    expect(
      container.querySelector("[data-parallax] [data-poster]"),
    ).not.toBeNull();
  });
});

describe("App content", () => {
  it("renders no personal gmail", () => {
    const { container } = render(<App />);
    expect(container.textContent).not.toContain("gmail.com");
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

describe("App nav jumps to the long-form (#111)", () => {
  /** an observer that never fires: the in-view trigger stays quiet, so only a jump can ask for the chunk */
  function quietObserver() {
    class IO {
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    }
    vi.stubGlobal("IntersectionObserver", IO);
  }

  // the gate's store remembers the page's one request: a fresh module graph
  // per test, with the scroll driver installed on the same graph the app reads
  const freshPage = async () => {
    vi.resetModules();
    const [{ default: FreshApp }, position] = await Promise.all([import("./App"), import("@/scroll/position")]);
    return { FreshApp, installScrollDriver: position.installScrollDriver };
  };

  afterEach(() => vi.unstubAllGlobals());

  it("a nav link to a long-form section asks for the chunk and lands once its words have mounted", async () => {
    quietObserver();
    const { FreshApp, installScrollDriver } = await freshPage();
    const { container } = render(<FreshApp />);
    const faq = container.querySelector("#faq")!;
    expect(faq).not.toBeNull();
    expect(faq.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector("#faq dl")).toBeNull();
    let wordsAtLanding: Element | null = null;
    const driver: ScrollDriver = {
      scrollTop: () => 0,
      scrollTo: vi.fn(() => {
        wordsAtLanding = container.querySelector("#faq dl");
      }),
    };
    installScrollDriver(driver);
    fireEvent.click(container.querySelector("nav a[href='#faq']")!);
    // not yet: the chunk is in flight
    expect(driver.scrollTo).not.toHaveBeenCalled();
    await waitFor(() => expect(driver.scrollTo).toHaveBeenCalledTimes(1));
    expect(driver.scrollTo).toHaveBeenCalledWith(expect.any(Number), true);
    expect(wordsAtLanding).not.toBeNull();
    // the same section element, now full: nothing the nav or the watch holds went stale
    expect(container.querySelector("#faq")).toBe(faq);
    expect(faq.getAttribute("aria-busy")).toBeNull();
    installScrollDriver(null);
  });

  it("a nav link to a scene stop goes at once, whatever the chunk is doing", async () => {
    quietObserver();
    const { FreshApp, installScrollDriver } = await freshPage();
    const { container } = render(<FreshApp />);
    const driver: ScrollDriver = { scrollTop: () => 0, scrollTo: vi.fn() };
    installScrollDriver(driver);
    fireEvent.click(container.querySelector("nav a[href='#give']")!);
    expect(driver.scrollTo).toHaveBeenCalledTimes(1);
    expect(container.querySelector("#faq dl")).toBeNull();
    installScrollDriver(null);
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
    // two drawings, one per layout: the desktop's column first, then the
    // phone's month across, under the headline and before the gatherings
    const drawings = panel.querySelectorAll("[data-gathering-calendar]");
    expect(drawings).toHaveLength(2);
    expect(drawings[0].getAttribute("data-across")).toBeNull();
    expect(drawings[1].getAttribute("data-across")).toBe("");
    const heading = panel.querySelector("h2")!;
    expect(
      heading.compareDocumentPosition(drawings[1]) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      drawings[1].compareDocumentPosition(homes) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // on desktop the pointer lights the phone's month too, the same way
    expect(drawings[1].getAttribute("data-lit")).toBe("feast");
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
    // two drawings, one per layout: the phone's two columns and the desktop's one
    const drawings = container.querySelectorAll("[data-shared-life]");
    expect(drawings).toHaveLength(2);
    expect(drawings[0].getAttribute("data-columns")).toBe("2");
    expect(drawings[1].getAttribute("data-columns")).toBe("1");
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

describe("App stops below lg (#56)", () => {
  // jsdom has no IntersectionObserver, so every stop's panel reports its
  // initial answer: settled on screen
  it("the ornaments play as the stop settles on screen, a beat after they are in, whatever the pointer does", async () => {
    belowLg();
    const { container } = render(<App />);
    const panel = container.querySelector("#house-churches [data-copy-panel]")!;
    const table = container.querySelector("[data-house-table]")!;
    const life = container.querySelector("[data-shared-life]")!;
    const field = container.querySelector("[data-sowing-mark]")!;
    const marks = container.querySelectorAll("#gatherings [data-gathering-mark]");
    expect(marks.length).toBeGreaterThan(1);
    // the panel is shown, its ornament in place and at rest first
    expect(panel.querySelector("[data-reveal]")!.getAttribute("data-reveal")).toBe("true");
    expect(table.getAttribute("data-lit")).toBeNull();
    fireEvent.mouseEnter(panel);
    expect(table.getAttribute("data-lit")).toBeNull();
    await waitFor(() => expect(table.getAttribute("data-lit")).toBe(""), {
      timeout: 3000,
    });
    expect(life.getAttribute("data-lit")).toBe("");
    expect(field.getAttribute("data-lit")).toBe("");
    // the emblems light in turn, the first with the rest of the ornaments,
    // and the month across lights for whichever lit last
    const month = container.querySelector(
      "#gatherings [data-gathering-calendar][data-across]",
    )!;
    expect(marks[0].getAttribute("data-lit")).toBe("");
    expect(marks[marks.length - 1].getAttribute("data-lit")).toBeNull();
    expect(month.getAttribute("data-lit")).toBe(marks[0].getAttribute("data-gathering-mark"));
    await waitFor(
      () => expect(marks[marks.length - 1].getAttribute("data-lit")).toBe(""),
      { timeout: 3000 },
    );
    expect(month.getAttribute("data-lit")).toBe(
      marks[marks.length - 1].getAttribute("data-gathering-mark"),
    );
    fireEvent.mouseLeave(panel);
    expect(table.getAttribute("data-lit")).toBe("");
  });

  it("the visit stop's way in shows one step at a time (from lg up the whole rail)", () => {
    belowLg();
    const { container } = render(<App />);
    const way = container.querySelector("#visit [data-way-in]")!;
    expect(way.hasAttribute("data-single")).toBe(true);
    expect(container.querySelectorAll("#visit [data-way-step]").length).toBe(1);
    expect(container.querySelector("#visit [data-way-traveller]")).toBeNull();
    fireEvent.click(container.querySelector<HTMLButtonElement>("#visit [data-way-arrow='next']")!);
    expect(way.getAttribute("data-step")).toBe("1");
    expect(way.getAttribute("data-way-dir")).toBe("next");
    expect(container.querySelectorAll("#visit [data-way-step]").length).toBe(1);
    cleanup();
    vi.restoreAllMocks();
    const { container: desktop } = render(<App />);
    expect(desktop.querySelectorAll("#visit [data-way-step]").length).toBe(5);
    expect(desktop.querySelector("#visit [data-way-in]")!.hasAttribute("data-single")).toBe(false);
  });

  it("under reduced motion the panels are shown and the ornaments rest", async () => {
    matchOnly(BELOW_LG_QUERY, REDUCED_MOTION_QUERY);
    const { container } = render(<App />);
    const panel = container.querySelector("#house-churches [data-copy-panel]")!;
    expect(panel.querySelector("[data-reveal]")!.getAttribute("data-reveal")).toBe("true");
    const table = container.querySelector("[data-house-table]")!;
    expect(table.getAttribute("data-lit")).toBeNull();
    await new Promise((r) => setTimeout(r, 1500));
    expect(table.getAttribute("data-lit")).toBeNull();
    expect(container.querySelector("[data-sowing-mark]")!.getAttribute("data-lit")).toBeNull();
    expect(container.querySelector("#gatherings [data-gathering-mark]")!.getAttribute("data-lit")).toBeNull();
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

  it("the rail sits outside the smoother's content, and its dots jump through the driver", async () => {
    const driver: ScrollDriver = { scrollTop: () => 0, scrollTo: vi.fn() };
    const { container } = render(<App />);
    const rail = container.querySelector("[data-dot-rail]")!;
    expect(container.querySelector("#smooth-wrapper")!.contains(rail)).toBe(
      false,
    );
    installScrollDriver(driver);
    fireEvent.click(rail.querySelector("a[href='#faq']")!);
    // a long-form dot waits for the chunk (App nav jumps, below); at once once it is in
    await waitFor(() => expect(driver.scrollTo).toHaveBeenCalledWith(expect.any(Number), true));
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

  it("the long-form lists reveal per item, the list itself plain (#58)", async () => {
    const { container } = render(<App />);
    const longform = await longformIn(container);
    const lists = [
      ["#devotions ol", site.devotions.length],
      ["#beliefs ul", site.beliefPosture.length],
      ["#beliefs dl", site.beliefs.length],
      ["#faq dl", site.faq.length],
      ["#messages ol", site.messages.latest.length],
    ] as const;
    for (const [sel, n] of lists) {
      const list = longform.querySelector(sel)!;
      expect(list, sel).not.toBeNull();
      // a whole-list reveal waits on a fraction of the whole: screens of blank ink on a phone
      expect(list.hasAttribute("data-reveal"), sel).toBe(false);
      const items = Array.from(list.children);
      expect(items.length, sel).toBe(n);
      for (const item of items)
        expect(item.getAttribute("data-reveal"), sel).not.toBeNull();
    }
    // the hairline items keep their rule on the revealed element itself
    for (const item of longform.querySelectorAll(".rule-draw"))
      expect(item.hasAttribute("data-reveal")).toBe(true);
  });

  it("the long-form sections carry no screen label and sit after the scene", async () => {
    const { container } = render(<App />);
    const longform = await longformIn(container);
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

  it("the frame's square corners carry red brackets; each long-form section opens with a rule", async () => {
    const { container } = render(<App />);
    await longformIn(container);
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

  it("the static poster renders no front canvas", () => {
    seams.webgl = false;
    const { container } = render(<App />);
    expect(container.querySelector("[data-parallax-front]")).toBeNull();
  });
});
