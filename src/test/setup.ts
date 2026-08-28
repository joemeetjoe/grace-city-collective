import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom has no matchMedia; gsap's ScrollTrigger touches it on registration and
// the intro consults prefers-reduced-motion. Tests override via vi.spyOn.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

// jsdom lays nothing out: no SVG CTM either. gsap's Flip reads it to place
// the lockup's seal and script, so hand it an identity matrix.
if (typeof SVGGraphicsElement !== "undefined" && !SVGGraphicsElement.prototype.getCTM) {
  const identity = (): DOMMatrix =>
    ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0, inverse: identity }) as unknown as DOMMatrix;
  SVGGraphicsElement.prototype.getCTM = identity;
  SVGGraphicsElement.prototype.getScreenCTM = identity;
}

afterEach(() => cleanup());
