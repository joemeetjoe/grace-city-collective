import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import MobileNav, { MARK_SIZE, MENU_LABEL } from "./MobileNav";
import { site } from "@/content/site";

afterEach(() => vi.restoreAllMocks());

function openSheet() {
  fireEvent.click(screen.getByRole("button", { name: MENU_LABEL }));
  return screen.getByRole("dialog");
}

describe("MobileNav", () => {
  it("at rest shows the ruled G mark, named for the site, and a Menu button, and no links", () => {
    const { container } = render(<MobileNav />);
    const mark = container.querySelector('[data-mobile-nav] [data-g-mark][role="img"]') as SVGSVGElement;
    expect(mark).not.toBeNull();
    expect(mark.getAttribute("aria-label")).toBe(site.name);
    expect(mark.querySelector("[data-g-mark-rule]")).not.toBeNull();
    expect(mark.style.height).toBe(`${MARK_SIZE}px`);
    expect(container.querySelector("[data-mobile-nav] [data-seal]")).toBeNull();
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

  it("the sheet marks the current section's link in the seal colour", () => {
    render(<MobileNav activeId="faq" />);
    const sheet = openSheet();
    const current = sheet.querySelector("nav a[aria-current='location']")!;
    expect(current.getAttribute("href")).toBe("#faq");
    expect(current.className).toContain("text-seal");
    expect(sheet.querySelectorAll("[aria-current]").length).toBe(1);
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

  it("a link click closes the sheet and hands the target id up", () => {
    const onNavigate = vi.fn();
    render(<MobileNav onNavigate={onNavigate} />);
    const sheet = openSheet();
    fireEvent.click(sheet.querySelector("a[href='#faq']")!);
    expect(onNavigate).toHaveBeenCalledWith("faq");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("the bar's mark points back at the top and is the intro traveller's landing; the sheet's is not", () => {
    const onNavigate = vi.fn();
    const { container } = render(<MobileNav onNavigate={onNavigate} />);
    const link = container.querySelector("[data-mobile-nav] a[href='#hero']")!;
    expect(link.hasAttribute("data-nav-mark")).toBe(true);
    expect(link.querySelector("[data-g-mark]")).not.toBeNull();
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledWith("hero");
    const sheet = openSheet();
    const sheetMark = sheet.querySelector("a[href='#hero'] [data-g-mark]") as SVGSVGElement;
    expect(sheetMark.getAttribute("aria-label")).toBe(site.name);
    expect(sheetMark.style.height).toBe(`${MARK_SIZE}px`);
    expect(sheet.querySelector("[data-nav-mark]")).toBeNull();
    expect(document.querySelectorAll("[data-nav-mark]").length).toBe(1);
  });
});
