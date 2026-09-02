import { act, fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { chromeWords, site, wayInWords } from "@/content/site";
import { REDUCED_MOTION_QUERY } from "@/device/reducedMotion";
import { INTRO_PLAYED_KEY } from "@/features/intro/introPolicy";
import { MENU_LABEL } from "@/features/nav/mobileNavLabels";
import { BELOW_LG_QUERY } from "@/theme/breakpoints";

// One axe pass over the whole App under jsdom (Vitals 10/13, #112), so a
// pull request goes red locally before Lighthouse CI sees it. The same
// seams as App.test.tsx: jsdom has no WebGL, so the scene is stubbed and
// the device reports WebGL present. #130 runs it in every state the
// keyboard can put the page in — the sheet open, the way in stepped, an
// ornament lit — on both tiers.
vi.mock("@/device/fallback", async (orig) => ({
  ...(await orig<typeof import("@/device/fallback")>()),
  detectWebgl: () => true,
}));

vi.mock("@/engine/PentecostParallax", async () => {
  const { useEffect } = await import("react");
  const { useAppStore } = await import("@/state/appStore");
  function ParallaxStub() {
    useEffect(() => useAppStore.getState().markReady(), []);
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

/** one line per violation: its id, impact and the nodes it points at */
function describeViolations(violations: axe.Result[]): string {
  return violations
    .map(
      (v) =>
        `${v.id} [${v.impact ?? "n/a"}] ${v.help}\n` +
        v.nodes.map((n) => `    ${n.target.join(" ")}\n      ${n.failureSummary ?? ""}`).join("\n"),
    )
    .join("\n");
}

async function runAxe(): Promise<axe.Result[]> {
  const results = await axe.run(document.body, {
    rules: {
      // contrast needs real layout and paint, which jsdom does not have;
      // Lighthouse CI's accessibility category checks it on the built site
      "color-contrast": { enabled: false },
    },
  });
  return results.violations;
}

async function expectNoViolations() {
  const violations = await runAxe();
  expect(violations.length, `axe violations:\n${describeViolations(violations)}`).toBe(0);
}

const words = chromeWords(site);
const way = wayInWords(site);

beforeEach(() => {
  window.sessionStorage.clear();
  stubFontSize(120);
});
afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe("App accessibility (axe)", () => {
  it("a first visit, splash and all, has no violations", async () => {
    render(<App />);
    await expectNoViolations();
  });

  it("a session past the intro has no violations", async () => {
    window.sessionStorage.setItem(INTRO_PLAYED_KEY, "1");
    render(<App />);
    await expectNoViolations();
  });

  it("under reduced motion, poster and all, has no violations", async () => {
    matchOnly(REDUCED_MOTION_QUERY);
    render(<App />);
    await expectNoViolations();
  });

  describe.each([
    ["from lg up", () => matchOnly()],
    ["below lg", () => matchOnly(BELOW_LG_QUERY)],
  ])("%s, past the intro", (_tier, tier) => {
    beforeEach(() => {
      tier();
      window.sessionStorage.setItem(INTRO_PLAYED_KEY, "1");
    });

    it("with the menu sheet open", async () => {
      render(<App />);
      fireEvent.click(screen.getByRole("button", { name: MENU_LABEL }));
      expect(screen.getByRole("dialog", { name: MENU_LABEL })).toBeInTheDocument();
      await expectNoViolations();
    });

    it("with the way in stepped to its end", async () => {
      render(<App />);
      const next = screen.getByRole("button", { name: way.next.label });
      for (let i = 0; i < 4; i++) fireEvent.click(next);
      expect(next).toBeDisabled();
      await expectNoViolations();
    });

    it("with an ornament lit by its switch", async () => {
      render(<App />);
      const table = screen.getAllByRole("button", { name: words.table })[0];
      await act(async () => {
        fireEvent.click(table);
      });
      expect(table).toHaveAttribute("aria-pressed", "true");
      await expectNoViolations();
    });
  });
});

describe("App accessibility semantics (#130)", () => {
  beforeEach(() => window.sessionStorage.setItem(INTRO_PLAYED_KEY, "1"));

  it("names the nav landmarks: the primary nav, the section rail, and the sheet's own", () => {
    render(<App />);
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Sections" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: MENU_LABEL }));
    expect(screen.getByRole("dialog", { name: MENU_LABEL })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Site" })).toBeInTheDocument();
  });

  it("the desktop links are a list, one item per nav entry", () => {
    render(<App />);
    const primary = screen.getByRole("navigation", { name: "Primary" });
    const list = primary.querySelector("ul")!;
    expect(list).not.toBeNull();
    const items = Array.from(list.children);
    expect(items.every((li) => li.tagName === "LI")).toBe(true);
    expect(items.map((li) => li.querySelector("a")?.textContent)).toEqual(site.nav.map((n) => n.label));
  });

  it("a dot's visible label is its accessible name: no aria-label of its own", () => {
    render(<App />);
    const rail = screen.getByRole("navigation", { name: "Sections" });
    for (const a of rail.querySelectorAll("a")) {
      expect(a.hasAttribute("aria-label")).toBe(false);
      const label = a.querySelector("span:not([aria-hidden])")!;
      expect(label.textContent!.length).toBeGreaterThan(0);
    }
    expect(screen.getAllByRole("link", { name: site.nav[0].label }).length).toBeGreaterThanOrEqual(2);
  });

  it("every G mark link is named Home, in the corner, on the bar and in the sheet", () => {
    render(<App />);
    const marks = screen.getAllByRole("link", { name: "Home" });
    expect(marks).toHaveLength(2);
    for (const a of marks) expect(a.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(screen.getByRole("button", { name: MENU_LABEL }));
    // the sheet hides the page behind it (radix), so its own mark is the one link left named Home
    const sheet = screen.getByRole("dialog", { name: MENU_LABEL });
    const inSheet = screen.getAllByRole("link", { name: "Home" });
    expect(inSheet).toHaveLength(1);
    expect(sheet.contains(inSheet[0])).toBe(true);
  });

  it("the sheet describes itself with the content's words, and no link in it lacks a focus ring", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: MENU_LABEL }));
    const sheet = screen.getByRole("dialog", { name: MENU_LABEL });
    expect(sheet).toHaveAccessibleDescription(words.menu);
    for (const el of sheet.querySelectorAll("a, button")) {
      expect(el.className.split(/\s+/), el.textContent ?? "").toContain("focus-visible:ring-1");
    }
  });

  it("the page under the splash is inert while the intro plays, and the skip hint is read out", () => {
    window.sessionStorage.clear();
    const { container } = render(<App />);
    const page = container.querySelector("[inert]")!;
    expect(page).not.toBeNull();
    expect(page.contains(screen.getByRole("navigation", { name: "Primary" }))).toBe(true);
    expect(page.contains(document.getElementById("smooth-wrapper"))).toBe(true);
    const hint = screen.getByRole("status");
    expect(hint).toHaveTextContent(words.skipIntro);
    expect(page.contains(hint)).toBe(false);
  });

  it("no page is inert once the intro is past", () => {
    const { container } = render(<App />);
    expect(container.querySelector("[inert]")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("the way in's step is announced from one live region that stays put across steps", () => {
    const { container } = render(<App />);
    const region = container.querySelector("#visit [aria-live='polite']")!;
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute("aria-atomic", "true");
    expect(region.textContent).toContain(site.wayIn![0].title);
    fireEvent.click(screen.getByRole("button", { name: way.next.label }));
    expect(container.querySelector("#visit [aria-live='polite']")).toBe(region);
    expect(region.textContent).toContain(site.wayIn![1].title);
    expect(region.textContent).not.toContain(site.wayIn![0].title);
  });

  it("each hover-lit ornament has a pressable switch named from the content, lighting it on a press and off again", () => {
    pressEveryOrnament();
  });

  // below lg there is no pointer to hover with, so the switch is the only way
  // in — and it must light the drawing there too, not merely say it is pressed
  it("the switches light their ornaments below lg too, where a touch has no hover", () => {
    matchOnly(BELOW_LG_QUERY);
    pressEveryOrnament();
  });
});

/** press each hover-lit ornament's switch in turn: it lights on the press and goes out again */
function pressEveryOrnament() {
  const { container } = render(<App />);
  const check = (name: string, id: string, drawn: (root: Element) => boolean) => {
    const switches = screen.getAllByRole("button", { name });
    for (const s of switches) expect(s).toHaveAttribute("aria-pressed", "false");
    const stop = container.querySelector(`#${id}`)!;
    expect(drawn(stop)).toBe(false);
    fireEvent.click(switches[0]);
    for (const s of switches) expect(s).toHaveAttribute("aria-pressed", "true");
    expect(drawn(stop)).toBe(true);
    fireEvent.click(switches[0]);
    expect(drawn(stop)).toBe(false);
  };
  const lit = (root: Element) => root.querySelector("svg.is-lit") !== null;
  check(words.table, "house-churches", lit);
  check(words.life, "about", lit);
  check(words.field, "give", (root) => root.querySelector("[data-sowing-mark][data-lit]") !== null);
  const feast = site.gatherings.find((g) => g.mark === "feast")!;
  check(`${words.month}: ${feast.title}`, "gatherings", lit);
}
