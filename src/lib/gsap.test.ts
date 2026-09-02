import { describe, expect, it } from "vitest";

import { gsap } from "./gsap";

/** the registry is real but untyped */
const globals = () => (gsap.core as unknown as { globals: () => Record<string, unknown> }).globals();

describe("gsap", () => {
  it("registers no plugin at import: each module registers the plugins it uses", () => {
    const registered = globals();
    expect(registered.ScrollTrigger).toBeUndefined();
    expect(registered.ScrollSmoother).toBeUndefined();
    expect(registered.Observer).toBeUndefined();
    expect(registered._SplitText).toBeUndefined();
    expect(registered.DrawSVGPlugin).toBeUndefined();
    const plugins = (gsap as unknown as { plugins: Record<string, unknown> }).plugins;
    expect(Object.keys(plugins)).not.toContain("drawSVG");
  });

  it("the modules that use a plugin register it on import, and a second registration is a no-op", async () => {
    const { ScrollTrigger } = await import("gsap/ScrollTrigger");
    const { ScrollSmoother } = await import("gsap/ScrollSmoother");
    const { Observer } = await import("gsap/Observer");
    const { SplitText } = await import("gsap/SplitText");
    await import("@/scroll/smoother");
    expect(globals().ScrollTrigger).toBe(ScrollTrigger);
    expect(globals().ScrollSmoother).toBe(ScrollSmoother);
    await import("@/scroll/attachPager");
    expect(globals().Observer).toBe(Observer);
    await import("@/features/intro/heroRise");
    expect(globals()._SplitText).toBe(SplitText);
    gsap.registerPlugin(ScrollTrigger, ScrollSmoother, Observer, SplitText);
    expect(globals().ScrollTrigger).toBe(ScrollTrigger);
  });
});
