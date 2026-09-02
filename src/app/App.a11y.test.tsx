import { render } from "@testing-library/react";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import { INTRO_PLAYED_KEY } from "@/features/intro/introPolicy";
import { installScrollDriver } from "@/scroll/position";

// One axe pass over the whole App under jsdom (Vitals 10/13, #112), so a
// pull request goes red locally before Lighthouse CI sees it. The same
// seams as App.test.tsx: jsdom has no WebGL, so the scene is stubbed and
// the device reports WebGL present.
vi.mock("@/device/fallback", async (orig) => ({
  ...(await orig<typeof import("@/device/fallback")>()),
  detectWebgl: () => true,
}));

vi.mock("@/engine/PentecostParallax", async () => {
  const { useEffect } = await import("react");
  const { useAppStore } = await import("@/state/appStore");
  function ParallaxStub() {
    useEffect(() => useAppStore.getState().markReady(), []);
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

/** one line per violation: its id, impact and the nodes it points at */
function describeViolations(violations: axe.Result[]): string {
  return violations
    .map(
      (v) =>
        `${v.id} [${v.impact ?? "n/a"}] ${v.help}\n` +
        v.nodes.map((n) => `    ${n.target.join(" ")}\n      ${n.failureSummary ?? ""}`).join("\n"),
    )
    .join("\n");
}

async function runAxe(): Promise<axe.Result[]> {
  const results = await axe.run(document.body, {
    rules: {
      // contrast needs real layout and paint, which jsdom does not have;
      // Lighthouse CI's accessibility category checks it on the built site
      "color-contrast": { enabled: false },
    },
  });
  return results.violations;
}

beforeEach(() => {
  window.sessionStorage.clear();
  stubFontSize(120);
});
afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
  installScrollDriver(null);
});

describe("App accessibility (axe)", () => {
  it("a first visit, splash and all, has no violations", async () => {
    render(<App />);
    const violations = await runAxe();
    expect(violations.length, `axe violations:\n${describeViolations(violations)}`).toBe(0);
  });

  it("a session past the intro has no violations", async () => {
    window.sessionStorage.setItem(INTRO_PLAYED_KEY, "1");
    render(<App />);
    const violations = await runAxe();
    expect(violations.length, `axe violations:\n${describeViolations(violations)}`).toBe(0);
  });
});
