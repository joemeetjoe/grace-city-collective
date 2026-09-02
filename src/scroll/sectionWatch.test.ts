import { ScrollTrigger } from "gsap/ScrollTrigger";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SectionId } from "@/content/site";

import { watchSections } from "./sectionWatch";

afterEach(() => {
  ScrollTrigger.killAll();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

function layout(tops: Partial<Record<SectionId, number>>, viewport = 900) {
  Object.defineProperty(window, "innerHeight", { value: viewport, configurable: true });
  return (Object.entries(tops) as [SectionId, number][]).map(([id, top]) => {
    const el = document.createElement("section");
    el.id = id;
    vi.spyOn(el, "getBoundingClientRect").mockImplementation(() => ({ top }) as DOMRect);
    document.body.appendChild(el);
    return { id, el };
  });
}

describe("watchSections", () => {
  it("creates one trigger per section spanning the viewport's midpoint, and kills them on stop", () => {
    const sections = layout({ hero: 0, about: 900 });
    const watch = watchSections(sections, () => {});
    const triggers = ScrollTrigger.getAll();
    expect(triggers.map((t) => t.trigger)).toEqual(sections.map((s) => s.el));
    watch.stop();
    expect(ScrollTrigger.getAll()).toEqual([]);
  });

  it("settles the active section from the boxes at once: the one under the midpoint", () => {
    const setActive = vi.fn();
    watchSections(layout({ hero: -1200, about: -300, faq: 600 }), setActive);
    expect(setActive).toHaveBeenLastCalledWith("about");
  });

  it("a trigger entering the midpoint band makes its section active; leaving it does not clear it", () => {
    const setActive = vi.fn();
    watchSections(layout({ hero: 0, about: 900 }), setActive);
    setActive.mockClear();
    const about = ScrollTrigger.getAll()[1];
    about.vars.onToggle?.({ isActive: true } as ScrollTrigger);
    expect(setActive).toHaveBeenLastCalledWith("about");
    setActive.mockClear();
    about.vars.onToggle?.({ isActive: false } as ScrollTrigger);
    expect(setActive).not.toHaveBeenCalled();
  });

  it("re-reads the boxes on every ScrollTrigger refresh, and stops listening once stopped", () => {
    const setActive = vi.fn();
    const sections = layout({ hero: 0, about: 900 });
    const watch = watchSections(sections, setActive);
    setActive.mockClear();
    // the page moved under the reader (a resize, the smoother's own refresh)
    vi.spyOn(sections[1].el, "getBoundingClientRect").mockImplementation(() => ({ top: 100 }) as DOMRect);
    ScrollTrigger.refresh();
    expect(setActive).toHaveBeenLastCalledWith("about");
    watch.stop();
    setActive.mockClear();
    ScrollTrigger.refresh();
    expect(setActive).not.toHaveBeenCalled();
  });

  it("measures every section's document top for the pager, and tells its listeners after each measure", () => {
    const sections = layout({ hero: 0, about: 900 });
    vi.spyOn(sections[1].el, "offsetTop", "get").mockReturnValue(900);
    const watch = watchSections(sections, () => {});
    expect(watch.boxes().map((b) => [b.id, b.top])).toEqual([
      ["hero", 0],
      ["about", 900],
    ]);
    const listener = vi.fn(() => watch.boxes()[1].top);
    const off = watch.onMeasure(listener);
    vi.spyOn(sections[1].el, "offsetTop", "get").mockReturnValue(1000);
    ScrollTrigger.refresh();
    expect(listener).toHaveBeenCalledTimes(1);
    // the boxes were fresh by the time the listener heard
    expect(listener.mock.results[0].value).toBe(1000);
    off();
    ScrollTrigger.refresh();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
