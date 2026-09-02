import { describe, expect, it } from "vitest";

import { gsap, Observer, ScrollSmoother, ScrollTrigger, SplitText } from "./gsap";


describe("gsap", () => {
  it("registers Observer, ScrollTrigger, ScrollSmoother and SplitText, and nothing else", () => {
    // the registry is real but untyped
    const globals = (gsap.core as unknown as { globals: () => Record<string, unknown> }).globals();
    expect(globals.Observer).toBe(Observer);
    expect(globals.ScrollTrigger).toBe(ScrollTrigger);
    expect(globals.ScrollSmoother).toBe(ScrollSmoother);
    expect(globals._SplitText).toBe(SplitText);
    expect(globals.DrawSVGPlugin).toBeUndefined();
    const plugins = (gsap as unknown as { plugins: Record<string, unknown> }).plugins;
    expect(Object.keys(plugins)).not.toContain("drawSVG");
  });
});

