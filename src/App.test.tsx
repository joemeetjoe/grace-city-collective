import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { INTRO_PLAYED_KEY, REDUCED_MOTION_QUERY } from "@/intro/introPolicy";

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
});
afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
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
