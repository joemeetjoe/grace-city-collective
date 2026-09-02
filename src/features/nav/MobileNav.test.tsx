import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MobileNav from "./MobileNav";
import { HOME_LABEL, MENU_LABEL } from "./mobileNavLabels";
import { JumpProvider } from "@/app/JumpProvider";
import { chromeWords, site } from "@/content/site";
import { REST_STATE, useAppStore } from "@/state/appStore";
import { revealTargets } from "@/state/revealTargets";
import { NAV_MARK_SIZE } from "@/theme/measures";

// the sheet portals into the body, so the body is left to RTL's cleanup
afterEach(() => {
  vi.restoreAllMocks();
  useAppStore.setState(REST_STATE);
});

function openSheet() {
  fireEvent.click(screen.getByRole("button", { name: MENU_LABEL }));
  return screen.getByRole("dialog");
}

describe("MobileNav", () => {
  it("at rest shows the ruled G mark in a link named Home, and a Menu button, and no links", () => {
    const { container } = render(<MobileNav />);
    const home = screen.getByRole("link", { name: HOME_LABEL });
    expect(home.getAttribute("href")).toBe("#hero");
    const mark = home.querySelector("[data-g-mark]") as SVGSVGElement;
    expect(mark).not.toBeNull();
    // the mark is decoration to its link (#130): the link's name is the one read out
    expect(mark.getAttribute("aria-hidden")).toBe("true");
    expect(mark.querySelector("[data-g-mark-rule]")).not.toBeNull();
    expect(mark.style.height).toBe(`${NAV_MARK_SIZE}px`);
    expect(container.querySelector("[data-seal]")).toBeNull();
    expect(screen.getByRole("button", { name: MENU_LABEL })).not.toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(container.querySelectorAll("a[href^='#']").length).toBeLessThanOrEqual(1);
  });

  it("Menu opens a sheet with the eight links, Give and Join Sunday", () => {
    render(<MobileNav />);
    const sheet = openSheet();
    for (const n of site.nav) {
      expect(sheet.querySelector(`nav a[href='#${n.id}']`), n.label).not.toBeNull();
    }
    expect(sheet.querySelectorAll("nav a").length).toBe(site.nav.length);
    expect(sheet.querySelector("a[href='#give']")).not.toBeNull();
    expect(sheet.textContent).toContain("Join Sunday");
    const visits = Array.from(sheet.querySelectorAll("a[href='#visit']")).map((a) => a.textContent);
    expect(visits).toEqual(["Visit", "Join Sunday"]);
  });

  it("the sheet marks the store's current section's link in the seal colour", () => {
    useAppStore.setState({ activeId: "faq" });
    render(<MobileNav />);
    const sheet = openSheet();
    const current = sheet.querySelector("nav a[aria-current='location']")!;
    expect(current.getAttribute("href")).toBe("#faq");
    expect(current.className).toContain("text-seal");
    expect(sheet.querySelectorAll("[aria-current]").length).toBe(1);
  });

  it("the sheet is a dialog named Menu and described in the content's words, that takes focus and hides the bar behind it (the radix Dialog's labelling and trap)", () => {
    const { container } = render(<MobileNav />);
    const sheet = openSheet();
    expect(screen.getByRole("dialog", { name: MENU_LABEL })).toBe(sheet);
    expect(sheet.getAttribute("aria-labelledby")).toBe(sheet.querySelector("h2")!.id);
    expect(sheet).toHaveAccessibleDescription(chromeWords(site).menu);
    expect(sheet.getAttribute("aria-describedby")).toBe(sheet.querySelector("p.sr-only")!.id);
    expect(sheet.contains(document.activeElement)).toBe(true);
    expect(container.getAttribute("aria-hidden")).toBe("true");
  });

  it("Escape closes the sheet", () => {
    render(<MobileNav />);
    openSheet();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the Close button closes the sheet", () => {
    render(<MobileNav />);
    const sheet = openSheet();
    fireEvent.click(sheet.querySelector("button[aria-label='Close menu']")!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("a link click closes the sheet and jumps to the section instead of following the hash", () => {
    const jump = vi.fn();
    render(
      <JumpProvider jump={jump}>
        <MobileNav />
      </JumpProvider>,
    );
    const sheet = openSheet();
    const followed = fireEvent.click(sheet.querySelector("nav a[href='#give']")!);
    expect(followed).toBe(false);
    expect(jump).toHaveBeenCalledTimes(1);
    expect(jump).toHaveBeenCalledWith("give");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the bar's mark points back at the top and is the intro traveller's landing; the sheet's is not", () => {
    const { container } = render(<MobileNav />);
    const link = container.querySelector("a[href='#hero']")!;
    expect(link.querySelector("[data-g-mark]")).not.toBeNull();
    expect(revealTargets("mark")).toEqual([link]);
    expect(fireEvent.click(link)).toBe(false);
    const sheet = openSheet();
    const sheetLink = sheet.querySelector("a[href='#hero']")!;
    expect(sheetLink.getAttribute("aria-label")).toBe(HOME_LABEL);
    const sheetMark = sheetLink.querySelector("[data-g-mark]") as SVGSVGElement;
    expect(sheetMark.getAttribute("aria-hidden")).toBe("true");
    expect(sheetMark.style.height).toBe(`${NAV_MARK_SIZE}px`);
    expect(revealTargets("mark")).toEqual([link]);
  });

  it("forgets its mark when it unmounts", () => {
    const { unmount } = render(<MobileNav />);
    expect(revealTargets("mark").length).toBe(1);
    unmount();
    expect(revealTargets("mark")).toEqual([]);
  });
});

describe("MobileNav class lists", () => {
  const tokens = (el: Element) => el.className.split(/\s+/);

  it("a resting link wears cream with a cream hover; the current one wears seal with no cream", () => {
    useAppStore.setState({ activeId: "faq" });
    render(<MobileNav />);
    const sheet = openSheet();
    const rest = tokens(sheet.querySelector("nav a:not([aria-current])")!);
    const current = tokens(sheet.querySelector("nav a[aria-current='location']")!);
    expect(rest).toEqual(expect.arrayContaining(["text-cream/90", "hover:text-cream"]));
    expect(rest).not.toContain("text-seal");
    expect(current).toEqual(expect.arrayContaining(["text-seal", "hover:text-seal"]));
    expect(current).not.toContain("text-cream/90");
    expect(current).not.toContain("hover:text-cream");
  });

  it("the mark sits in the same seat on the bar and in the sheet", () => {
    const { container } = render(<MobileNav />);
    const bar = container.querySelector("a[href='#hero']")!.className;
    const sheet = openSheet();
    expect(sheet.querySelector("a[href='#hero']")!.className).toBe(bar);
    expect(bar.split(/\s+/)).toEqual(expect.arrayContaining(["inline-flex", "p-1.5", "text-cream", "rounded-tl-[12px]", "rounded-br-[12px]", "focus-visible:ring-1"]));
  });
});
