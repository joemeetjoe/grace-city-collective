import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { INTRO_PLAYED_KEY, REDUCED_MOTION_QUERY } from "@/intro/introPolicy";
import { installScrollDriver, type ScrollDriver } from "@/scroll/position";

// jsdom cannot probe for WebGL; each test says whether it is there
const seams = vi.hoisted(() => ({ webgl: true }));
vi.mock("@/scene/fallback", async (orig) => ({
  ...(await orig<typeof import("@/scene/fallback")>()),
  detectWebgl: () => seams.webgl,
}));

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
      Object.defineProperty(style, "fontSize", { value: `${px}px`, configurable: true });
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
    const button = hero.querySelector('button[aria-label="Replay the seal stamp"]')!;
    expect(button).not.toBeNull();
    const seal = button.querySelector('[data-lockup="seal"]')!;
    // live variant, resting with its overlay off
    expect(seal.querySelectorAll("filter").length).toBeGreaterThan(0);
    expect((seal.querySelector('[data-seal="live"]') as SVGGElement).style.display).toBe("none");
    expect(container.querySelector("[data-intro-splash] button")).toBeNull();
  });
});

describe("App nav", () => {
  it("the desktop nav carries no seal — the mark lives in the lockup and the mobile nav", () => {
    const { container } = render(<App />);
    const marks = Array.from(container.querySelectorAll('nav svg[role="img"]'));
    expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) expect(mark.closest("[data-mobile-nav]")).not.toBeNull();
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
    expect(container.querySelector("[data-parallax] [data-parallax-stub]")).not.toBeNull();
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
    expect(container.querySelector("[data-parallax] [data-poster]")).not.toBeNull();
    const parallax = container.querySelector("[data-parallax]") as HTMLElement;
    expect(parseFloat(parallax.style.opacity)).toBeLessThan(1);
  });

  it("under Save-Data the poster stands in", () => {
    Object.defineProperty(navigator, "connection", { value: { saveData: true }, configurable: true });
    try {
      const { container } = render(<App />);
      expect(container.querySelector("[data-parallax] [data-poster]")).not.toBeNull();
    } finally {
      delete (navigator as { connection?: unknown }).connection;
    }
  });
});

describe("App content", () => {
  const facts = [
    "Sunday Worship Gathering",
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
    for (const gone of ["Est. 2019", "123 Placeholder Ave", "Prayer at Dawn", "Midweek Table", "gmail.com"]) {
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

describe("App page structure", () => {
  it("the scene is exactly six labelled viewports, in order", () => {
    const { container } = render(<App />);
    const labels = Array.from(container.querySelectorAll("section[data-screen-label]")).map(
      (s) => (s as HTMLElement).dataset.screenLabel,
    );
    expect(labels).toEqual(["Hero", "Who we are", "House churches", "Gatherings", "Give", "Visit"]);
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
    expect(scene.contains(container.querySelector("[data-parallax]"))).toBe(true);
    expect(scene.contains(longform)).toBe(false);
    expect(scene.compareDocumentPosition(longform) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("the fixed layers sit outside the smoother's content; the scene and long-form inside it", () => {
    const { container } = render(<App />);
    const content = container.querySelector("#smooth-content")!;
    const wrapper = container.querySelector("#smooth-wrapper")!;
    expect(wrapper.contains(content)).toBe(true);
    expect(content.contains(container.querySelector("[data-scene]"))).toBe(true);
    expect(content.contains(container.querySelector("[data-longform]"))).toBe(true);
    // position: fixed does not survive a transformed ancestor
    expect(wrapper.contains(container.querySelector("nav"))).toBe(false);
    expect(wrapper.contains(container.querySelector("[data-intro-splash]"))).toBe(false);
  });
});
