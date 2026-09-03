import { describe, expect, it, vi } from "vitest";

import { gsap } from "@/lib/gsap";

import { SMOOTH_SECONDS } from "@/theme/motion";
import { jumpDuration, settleSmoother, smoothDriver, smootherOptions, type SmootherLike } from "./smoother";

describe("smootherOptions", () => {
  it("is null under reduced motion: native scroll, no smoother", () => {
    expect(smootherOptions({ reducedMotion: true, touch: false })).toBeNull();
  });

  it("is null on touch-only devices: they keep native scroll", () => {
    expect(smootherOptions({ reducedMotion: false, touch: true })).toBeNull();
  });

  it("lerps the wheel on desktop, about a second of catch-up, never smoothing touch", () => {
    const options = smootherOptions({ reducedMotion: false, touch: false });
    expect(options).not.toBeNull();
    expect(options!.smooth).toBe(SMOOTH_SECONDS);
    expect(options!.smoothTouch).toBe(false);
  });

  it("reduced motion wins over everything", () => {
    expect(smootherOptions({ reducedMotion: true, touch: true })).toBeNull();
  });
});

describe("jumpDuration", () => {
  it("scales with distance, between half a second and 1.4 s", () => {
    expect(jumpDuration(0)).toBeCloseTo(0.5);
    expect(jumpDuration(900)).toBeGreaterThan(0.5);
    expect(jumpDuration(900)).toBeLessThan(jumpDuration(4500));
    expect(jumpDuration(100_000)).toBe(1.4);
  });
});

describe("smoothDriver", () => {
  const fakeSmoother = () => ({
    scrollTop: vi.fn(() => 1000),
    scrollTo: vi.fn(),
    scrollTrigger: { animation: { progress: vi.fn(() => 0.1) } },
  }) satisfies SmootherLike;

  it("reads the smoothed position", () => {
    const sm = fakeSmoother();
    expect(smoothDriver(sm).scrollTop()).toBe(1000);
  });

  it("an instant jump goes straight to the smoother", () => {
    const sm = fakeSmoother();
    smoothDriver(sm).scrollTo(2500, false);
    expect(sm.scrollTo).toHaveBeenCalledWith(2500, false);
  });

  it("an eased jump tweens the smoother's own scrollTop, so the content is placed each frame", () => {
    // ScrollSmoother.scrollTo(top, true) only moves the native scroll and lets
    // the lerp follow; after a ScrollTrigger snap that single scroll event can
    // be swallowed and the content freezes. Tweening scrollTop cannot be.
    const sm = fakeSmoother();
    const to = vi.spyOn(gsap, "to").mockImplementation(() => ({ kill: vi.fn() }) as unknown as gsap.core.Tween);
    smoothDriver(sm).scrollTo(2500, true);
    expect(sm.scrollTo).not.toHaveBeenCalled();
    expect(to).toHaveBeenCalledTimes(1);
    const [target, vars] = to.mock.calls[0];
    expect(target).toBe(sm);
    expect(vars.scrollTop).toBe(2500);
    expect(vars.duration).toBeCloseTo(jumpDuration(1500));
    expect(vars.overwrite).toBe("auto");
  });
});

describe("settleSmoother", () => {
  // ScrollTrigger rounds the values its snap tween writes to the smoother, so
  // the tween's last two frames write the same pixel; the second write leaves
  // the smoother's isProxyScrolling flag set with no update to clear it, and
  // the next lone scroll event is swallowed (the content freezes). Nudging the
  // main trigger's animation runs the onUpdate that clears the flag.
  function fakeAt(progress: number) {
    let p = progress;
    const set = vi.fn((v: number) => {
      p = v;
    });
    const smoother: SmootherLike = {
      scrollTop: () => 0,
      scrollTo: () => {},
      scrollTrigger: { animation: { progress: ((v?: number) => (v === undefined ? p : set(v))) as NonNullable<SmootherLike["scrollTrigger"]["animation"]>["progress"] } },
    };
    return { smoother, set };
  }

  it("moves the main trigger's animation by an invisible amount, so its onUpdate fires", () => {
    const { smoother, set } = fakeAt(0.3);
    settleSmoother(smoother);
    expect(set).toHaveBeenCalledTimes(1);
    const v = set.mock.calls[0][0];
    expect(v).not.toBe(0.3);
    expect(Math.abs(v - 0.3)).toBeLessThan(1e-5);
  });

  it("nudges backwards at the end, where forwards would clamp to the same value", () => {
    const { smoother, set } = fakeAt(1);
    settleSmoother(smoother);
    expect(set.mock.calls[0][0]).toBeLessThan(1);
  });
});

describe("createSmoothScroll", () => {
  it("registers ScrollTrigger and ScrollSmoother itself, on import", async () => {
    const { ScrollTrigger } = await import("gsap/ScrollTrigger");
    const { ScrollSmoother } = await import("gsap/ScrollSmoother");
    const globals = (gsap.core as unknown as { globals: () => Record<string, unknown> }).globals();
    expect(globals.ScrollTrigger).toBe(ScrollTrigger);
    expect(globals.ScrollSmoother).toBe(ScrollSmoother);
  });
});
