import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { REDUCED_MOTION_QUERY } from "@/intro/introPolicy";
import { gsap } from "@/lib/gsap";

import Lockup from "./Lockup";

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

/** the timelines currently animating the seal's root: the stamp beats in flight */
function beatsOn(seal: Element): gsap.core.Timeline[] {
  const tweens = gsap.globalTimeline.getChildren(true, true, false) as gsap.core.Tween[];
  const parents = tweens.filter((t) => t.targets().includes(seal)).map((t) => t.parent as gsap.core.Timeline);
  return [...new Set(parents)];
}

function renderHeroLockup() {
  stubFontSize(108);
  const { container } = render(<Lockup sealVariant="live" interactiveSeal />);
  const seal = container.querySelector<SVGSVGElement>('[data-lockup="seal"]')!;
  const overlay = seal.querySelector<SVGGElement>('[data-seal="live"]')!;
  return { button: screen.getByRole("button", { name: "Replay the seal stamp" }), seal, overlay };
}

afterEach(() => {
  gsap.globalTimeline.clear();
  vi.restoreAllMocks();
});

describe("Lockup", () => {
  it("renders the seal, the wordmark and the cursive line at hero sizes", () => {
    stubFontSize(108);
    render(<Lockup />);
    expect(screen.getByRole("img", { name: /seal/i })).toBeTruthy();
    expect(screen.getByText("Grace City")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Collective" })).toBeTruthy();
  });

  it("drops the cursive line when it would render under 18px", () => {
    stubFontSize(30);
    render(<Lockup />);
    expect(screen.getByText("Grace City")).toBeTruthy();
    expect(screen.queryByRole("img", { name: "Collective" })).toBeNull();
  });

  it("renders the cursive line on the first commit when told to, before any measurement", () => {
    stubFontSize(0);
    const { container } = render(<Lockup script />);
    expect(container.querySelector('[data-lockup="script"]')).not.toBeNull();
  });

  it("marks its parts for layout animation", () => {
    stubFontSize(108);
    const { container } = render(<Lockup />);
    for (const part of ["seal", "wordmark", "script"]) {
      expect(container.querySelector(`[data-lockup="${part}"]`), part).not.toBeNull();
    }
  });
});

describe("Lockup with an interactive seal", () => {
  it("wraps the seal in a labelled button that sits in the tab order", () => {
    stubFontSize(108);
    render(<Lockup sealVariant="live" interactiveSeal />);
    const button = screen.getByRole("button", { name: "Replay the seal stamp" });
    expect(button.tabIndex).toBe(0);
    expect(button.contains(screen.getByRole("img", { name: /seal/i }))).toBe(true);
  });

  it("is plain by default: no button around the seal", () => {
    stubFontSize(108);
    render(<Lockup />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("rests with the live overlay hidden even though the seal is the live variant", () => {
    const { seal, overlay } = renderHeroLockup();
    expect(seal.querySelectorAll("filter").length).toBeGreaterThan(0);
    expect(overlay.style.display).toBe("none");
    expect(seal.style.transform).toBe("");
    expect(beatsOn(seal)).toHaveLength(0);
  });

  it("plays the stamp once on click: overlay live and the seal squashed, then back to rest", () => {
    const { button, seal, overlay } = renderHeroLockup();
    fireEvent.click(button);
    const beats = beatsOn(seal);
    expect(beats).toHaveLength(1);
    beats[0].progress(0.3);
    expect(overlay.style.display).toBe("inline");
    expect(seal.style.transform).not.toBe("");
    beats[0].progress(1);
    expect(overlay.style.display).toBe("none");
    expect(seal.style.transform).toBe("");
    expect(beatsOn(seal)).toHaveLength(0);
  });

  it("plays on Enter and on Space, and on no other key", () => {
    const { button, seal } = renderHeroLockup();
    fireEvent.keyDown(button, { key: "a" });
    fireEvent.keyDown(button, { key: "Escape" });
    expect(beatsOn(seal)).toHaveLength(0);
    fireEvent.keyDown(button, { key: "Enter" });
    expect(beatsOn(seal)).toHaveLength(1);
    beatsOn(seal)[0].progress(1);
    fireEvent.keyDown(button, { key: " " });
    expect(beatsOn(seal)).toHaveLength(1);
    beatsOn(seal)[0].progress(1);
    expect(beatsOn(seal)).toHaveLength(0);
  });

  it("ignores a second click mid-beat: one beat, and the same clean rest at the end", () => {
    const { button, seal, overlay } = renderHeroLockup();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(beatsOn(seal)).toHaveLength(1);
    const [beat] = beatsOn(seal);
    beat.progress(0.5);
    fireEvent.click(button);
    expect(beatsOn(seal)).toEqual([beat]);
    beat.progress(1);
    expect(overlay.style.display).toBe("none");
    expect(seal.style.transform).toBe("");
    expect(beatsOn(seal)).toHaveLength(0);
    // the beat is over: the next click starts a fresh one
    fireEvent.click(button);
    expect(beatsOn(seal)).toHaveLength(1);
    expect(beatsOn(seal)[0]).not.toBe(beat);
  });

  it("does nothing under reduced motion", () => {
    preferReducedMotion();
    const { button, seal, overlay } = renderHeroLockup();
    fireEvent.click(button);
    fireEvent.keyDown(button, { key: "Enter" });
    expect(beatsOn(seal)).toHaveLength(0);
    expect(overlay.style.display).toBe("none");
    expect(seal.style.transform).toBe("");
  });

  it("kills a beat in flight when it unmounts", () => {
    const { button, seal } = renderHeroLockup();
    fireEvent.click(button);
    const [beat] = beatsOn(seal);
    expect(beat.isActive() || beat.progress() < 1).toBe(true);
    cleanup();
    expect(beatsOn(seal)).toHaveLength(0);
  });
});
