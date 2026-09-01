import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ScrollTrigger } from "@/lib/gsap";

import { type SectionWatch, useActiveSection, watchWithScrollTrigger } from "./useActiveSection";

afterEach(() => {
  ScrollTrigger.killAll();
  vi.restoreAllMocks();
});

const IDS = ["hero", "about", "faq"] as const;

function Probe({ watch }: { watch: SectionWatch }) {
  const active = useActiveSection(IDS, watch);
  return (
    <>
      <output>{active}</output>
      {IDS.map((id) => (
        <section key={id} id={id} />
      ))}
    </>
  );
}

describe("useActiveSection", () => {
  it("starts on the first section and follows whatever the watch reports", () => {
    let report: ((id: string) => void) | undefined;
    const stop = vi.fn();
    const watch: SectionWatch = (sections, setActive) => {
      expect(sections.map((s) => s.id)).toEqual([...IDS]);
      for (const s of sections) expect(s.el.id).toBe(s.id);
      report = setActive;
      return stop;
    };
    const { container, unmount } = render(<Probe watch={watch} />);
    const out = () => container.querySelector("output")!.textContent;
    expect(out()).toBe("hero");
    act(() => report!("faq"));
    expect(out()).toBe("faq");
    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("skips ids that are not on the page", () => {
    const seen: string[] = [];
    const watch: SectionWatch = (sections) => {
      seen.push(...sections.map((s) => s.id));
      return () => {};
    };
    function Sparse() {
      useActiveSection(["hero", "missing"], watch);
      return <section id="hero" />;
    }
    render(<Sparse />);
    expect(seen).toEqual(["hero"]);
  });
});

function layout(tops: Record<string, number>, viewport = 900) {
  Object.defineProperty(window, "innerHeight", { value: viewport, configurable: true });
  return Object.entries(tops).map(([id, top]) => {
    const el = document.createElement("section");
    el.id = id;
    vi.spyOn(el, "getBoundingClientRect").mockImplementation(() => ({ top }) as DOMRect);
    document.body.appendChild(el);
    return { id, el };
  });
}

describe("watchWithScrollTrigger", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("creates one trigger per section spanning the viewport's midpoint, and kills them on stop", () => {
    const sections = layout({ hero: 0, about: 900 });
    const stop = watchWithScrollTrigger(sections, () => {});
    const triggers = ScrollTrigger.getAll();
    expect(triggers.map((t) => t.trigger)).toEqual(sections.map((s) => s.el));
    stop();
    expect(ScrollTrigger.getAll()).toEqual([]);
  });

  it("settles the state from the boxes at once: the section under the midpoint", () => {
    const setActive = vi.fn();
    watchWithScrollTrigger(layout({ hero: -1200, about: -300, faq: 600 }), setActive);
    expect(setActive).toHaveBeenLastCalledWith("about");
  });

  it("a trigger entering the midpoint band makes its section active; leaving it does not clear it", () => {
    const setActive = vi.fn();
    watchWithScrollTrigger(layout({ hero: 0, about: 900 }), setActive);
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
    const stop = watchWithScrollTrigger(sections, setActive);
    setActive.mockClear();
    // the page moved under the reader (a resize, the smoother's own refresh)
    vi.spyOn(sections[1].el, "getBoundingClientRect").mockImplementation(() => ({ top: 100 }) as DOMRect);
    ScrollTrigger.refresh();
    expect(setActive).toHaveBeenLastCalledWith("about");
    stop();
    setActive.mockClear();
    ScrollTrigger.refresh();
    expect(setActive).not.toHaveBeenCalled();
  });
});
