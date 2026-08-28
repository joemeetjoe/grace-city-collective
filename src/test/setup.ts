import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom has no matchMedia; gsap's ScrollTrigger touches it on registration and
// the intro consults prefers-reduced-motion. Tests override via vi.spyOn — the
// stub is a plain function (not a vi.fn) so restoreAllMocks puts it back
// rather than leaving one test's implementation on a shared mock.
if (typeof window !== "undefined" && !window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
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
