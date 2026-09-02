import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { chromeWords, site, wayInWords } from "@/content/site";
import type { buildHandoff } from "@/features/intro/handoff";
import { MENU_LABEL } from "@/features/nav/mobileNavLabels";
import { BELOW_LG_QUERY } from "@/theme/breakpoints";

// The keyboard-only walk (#130): skip the intro, tab through the nav, open
// and close the sheet, step the way in to its end and back — focus is
// visible (every stop on the walk wears the theme's focus ring) and never
// lost to the body. jsdom moves no focus on Tab, so the walk focuses each
// tabbable in document order itself; the browser walk is the CDP script
// in docs/design/issue-130.
vi.mock("@/device/fallback", async (orig) => ({
  ...(await orig<typeof import("@/device/fallback")>()),
  detectWebgl: () => true,
}));

const handoffs = vi.hoisted(() => ({ list: [] as ReturnType<typeof buildHandoff>[] }));
vi.mock("@/features/intro/handoff", async (orig) => {
  const mod = await orig<typeof import("@/features/intro/handoff")>();
  return {
    ...mod,
    buildHandoff: (ctx: Parameters<typeof mod.buildHandoff>[0]) => {
      const tl = mod.buildHandoff(ctx);
      handoffs.list.push(tl);
      return tl;
    },
  };
});

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

/** the theme's focus ring (FOCUS_RING, theme/classes.ts), which every stop on the walk must wear */
const RING = "focus-visible:ring-1";

/** what Tab would reach, in document order, outside any inert subtree and any disabled control */
function tabbables(root: ParentNode): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>("a[href], button, [tabindex]:not([tabindex='-1'])"),
  ).filter((el) => !el.closest("[inert]") && !(el as HTMLButtonElement).disabled);
}

const active = () => document.activeElement;

beforeEach(() => {
  handoffs.list.length = 0;
  window.sessionStorage.clear();
  stubFontSize(120);
});
afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe("App keyboard walk (#130)", () => {
  it.each([
    ["from lg up", () => matchOnly()],
    ["below lg", () => matchOnly(BELOW_LG_QUERY)],
  ])("%s: skip, tab the nav, open and close the sheet, walk the way in there and back", async (_tier, tier) => {
    tier();
    const words = chromeWords(site);
    const way = wayInWords(site);
    const { container } = render(<App />);

    // the splash is up: the page under it is inert, nothing on it is tabbable, and the hint says a key skips
    expect(tabbables(container)).toHaveLength(0);
    expect(screen.getByRole("status")).toHaveTextContent(words.skipIntro);
    fireEvent.keyDown(window, { key: "Enter" });
    await waitFor(() => expect(handoffs.list).toHaveLength(1));
    act(() => {
      handoffs.list[0].progress(1);
    });
    expect(container.querySelector("[inert]")).toBeNull();

    // the nav: every link and button in the primary nav and the rail takes focus and wears the ring
    const primary = screen.getByRole("navigation", { name: "Primary" });
    const rail = screen.getByRole("navigation", { name: "Sections" });
    const navStops = [...tabbables(primary), ...tabbables(rail)];
    expect(navStops.length).toBeGreaterThan(site.nav.length);
    for (const el of navStops) {
      el.focus();
      expect(active()).toBe(el);
      expect(el.className.split(/\s+/), el.textContent || el.getAttribute("aria-label") || el.tagName).toContain(RING);
    }

    // the sheet: Menu opens it and focus moves in; every stop in it wears the ring; Escape closes it and focus returns
    const menu = screen.getByRole("button", { name: MENU_LABEL });
    menu.focus();
    fireEvent.click(menu);
    const sheet = screen.getByRole("dialog", { name: MENU_LABEL });
    expect(sheet.contains(active())).toBe(true);
    const sheetStops = tabbables(sheet);
    expect(sheetStops.length).toBe(site.nav.length + 4);
    for (const el of sheetStops) {
      el.focus();
      expect(active()).toBe(el);
      expect(el.className.split(/\s+/)).toContain(RING);
    }
    fireEvent.keyDown(active()!, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(active()).toBe(menu));

    // the way in: the next arrow to the end, focus stepping to the back arrow as it disables, and back again
    const next = screen.getByRole("button", { name: way.next.label });
    const back = screen.getByRole("button", { name: way.back.label });
    expect(back).toBeDisabled();
    next.focus();
    const steps = site.wayIn!.length;
    for (let i = 1; i < steps; i++) {
      fireEvent.click(active()!);
      expect(active()).not.toBe(document.body);
      expect(container.querySelector("#visit li[aria-current='step']")).toHaveAttribute("id", `way-in-step-${i}`);
    }
    expect(next).toBeDisabled();
    expect(active()).toBe(back);
    expect(back.className.split(/\s+/)).toContain(RING);
    for (let i = steps - 2; i >= 0; i--) {
      fireEvent.click(active()!);
      expect(active()).not.toBe(document.body);
      expect(container.querySelector("#visit li[aria-current='step']")).toHaveAttribute("id", `way-in-step-${i}`);
    }
    expect(back).toBeDisabled();
    expect(active()).toBe(next);

    // the ornaments' switches take focus too, and a press lights the drawing
    const table = screen.getAllByRole("button", { name: words.table })[0];
    table.focus();
    expect(active()).toBe(table);
    expect(table.className.split(/\s+/)).toContain(RING);
    fireEvent.click(table);
    expect(table).toHaveAttribute("aria-pressed", "true");
  });
});
