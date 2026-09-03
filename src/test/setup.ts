import "@testing-library/jest-dom/vitest";
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

afterEach(() => cleanup());
