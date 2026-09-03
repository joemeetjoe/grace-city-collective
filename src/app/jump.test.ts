import { afterEach, describe, expect, it, vi } from "vitest";

import type { SectionId } from "@/content/site";
import type { ScrollDriver } from "@/scroll/position";
import { jumpTo } from "./jump";

function section(id: string, top: number, scrollMarginTop = 0) {
  const el = document.createElement("section");
  el.id = id;
  el.getBoundingClientRect = () => ({ top }) as DOMRect;
  el.style.scrollMarginTop = `${scrollMarginTop}px`;
  document.body.appendChild(el);
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("jumpTo", () => {
  it("goes through the smoother when there is one, from its smoothed position", () => {
    section("give", 300);
    const driver: ScrollDriver = { scrollTop: () => 1000, scrollTo: vi.fn() };
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    expect(jumpTo("give", driver)).toBe(true);
    expect(driver.scrollTo).toHaveBeenCalledWith(1300, true);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("falls back to a smooth window.scrollTo without a smoother", () => {
    section("visit", 250);
    document.documentElement.scrollTop = 50;
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    expect(jumpTo("visit", null)).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 300, behavior: "smooth" });
  });

  it("honours the target's scroll-margin-top so the heading clears the nav", () => {
    const el = section("faq", 500, 96);
    vi.spyOn(window, "getComputedStyle").mockImplementation(
      (target) => ({ scrollMarginTop: target === el ? "96px" : "0px" }) as CSSStyleDeclaration,
    );
    const driver: ScrollDriver = { scrollTop: () => 0, scrollTo: vi.fn() };
    jumpTo("faq", driver);
    expect(driver.scrollTo).toHaveBeenCalledWith(404, true);
  });

  it("lands at once when immediate: no tween through the smoother, an instant scroll without one", () => {
    section("give", 300);
    const driver: ScrollDriver = { scrollTop: () => 1000, scrollTo: vi.fn() };
    expect(jumpTo("give", driver, { immediate: true })).toBe(true);
    expect(driver.scrollTo).toHaveBeenCalledWith(1300, false);
    document.documentElement.scrollTop = 50;
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    expect(jumpTo("give", null, { immediate: true })).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 350, behavior: "instant" });
  });

  it("does nothing for an id that is not on the page", () => {
    const driver: ScrollDriver = { scrollTop: () => 0, scrollTo: vi.fn() };
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    expect(jumpTo("nowhere" as SectionId, driver)).toBe(false);
    expect(driver.scrollTo).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
