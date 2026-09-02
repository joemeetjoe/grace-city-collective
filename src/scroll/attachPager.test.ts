import { Observer } from "gsap/Observer";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { gsap } from "@/lib/gsap";
import { attachPager, type PagerTargets } from "./attachPager";
import { PAGE_SECONDS } from "@/theme/motion";
import { PAGE_TOLERANCE } from "./pager";
import type { SmoothScroll } from "./smoother";

/** a smoother handle whose driver is a plain number */
function fakeSmooth(top = 0) {
  let y = top;
  const smooth: SmoothScroll = {
    driver: { scrollTop: () => y, scrollTo: vi.fn((next: number) => void (y = next)) },
    transforms: true,
    settle: vi.fn(),
    interrupt: vi.fn(),
    dispose: vi.fn(),
  };
  return smooth;
}

/** the pager's targets over a scene element; `measure` re-measures with new tops, as the watch would */
function targets(smooth: SmoothScroll | null, initial = [0, 900]): PagerTargets & { measured: Set<() => void>; measure(tops: number[]): void } {
  const scene = document.createElement("div");
  document.body.appendChild(scene);
  const measured = new Set<() => void>();
  let tops = initial;
  return {
    scene,
    smooth,
    tops: () => tops,
    onMeasure: (fn) => {
      measured.add(fn);
      return () => measured.delete(fn);
    },
    measured,
    measure(next) {
      tops = next;
      for (const fn of measured) fn();
    },
  };
}

const wheelEvent = (deltaY: number, timeStamp = 1000) => {
  const e = new WheelEvent("wheel", { deltaY, cancelable: true });
  Object.defineProperty(e, "timeStamp", { value: timeStamp });
  return e;
};

describe("attachPager", () => {
  let detach: (() => void) | null = null;
  beforeEach(() => {
    // the page opens on the hero, inside the scene
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true, writable: true });
  });
  afterEach(() => {
    detach?.();
    detach = null;
    ScrollTrigger.killAll();
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("creates the touch observer and the scene's trigger, and takes them down on detach", () => {
    const observer = vi.spyOn(Observer, "create");
    const t = targets(fakeSmooth());
    detach = attachPager(t);
    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer.mock.calls[0][0]).toMatchObject({ type: "touch", preventDefault: true, tolerance: PAGE_TOLERANCE });
    expect(ScrollTrigger.getAll().map((s) => s.trigger)).toEqual([t.scene]);
    expect(t.measured.size).toBe(1);
    detach();
    detach = null;
    expect(ScrollTrigger.getAll()).toEqual([]);
    expect(t.measured.size).toBe(0);
  });

  it("holds at once when the native position is in the scene: the observer is enabled", () => {
    const enable = vi.fn();
    vi.spyOn(Observer, "create").mockImplementation(
      () => ({ enable, disable: vi.fn(), kill: vi.fn() }) as unknown as Observer,
    );
    detach = attachPager(targets(fakeSmooth()));
    expect(enable).toHaveBeenCalledTimes(1);
  });

  it("a wheel notch inside the scene is prevented and turns the smoother to the next section", () => {
    const smooth = fakeSmooth();
    const to = vi.spyOn(gsap, "to");
    detach = attachPager(targets(smooth));
    const e = wheelEvent(100);
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(to).toHaveBeenCalledTimes(1);
    const [proxy, vars] = to.mock.calls[0];
    expect(proxy).toMatchObject({ y: 0 });
    expect(vars).toMatchObject({ y: 900, duration: PAGE_SECONDS });
    // an in-flight nav jump gave way
    expect(smooth.interrupt).toHaveBeenCalledTimes(1);
    // the turn writes to the smoother each frame, instantly
    const tween = to.mock.results[0].value as gsap.core.Tween;
    tween.progress(1);
    expect(smooth.driver.scrollTo).toHaveBeenLastCalledWith(900, false);
    expect(smooth.settle).toHaveBeenCalledTimes(1);
  });

  it("without a smoother the turn writes to the window", () => {
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const to = vi.spyOn(gsap, "to");
    detach = attachPager(targets(null));
    window.dispatchEvent(wheelEvent(100));
    const tween = to.mock.results[0].value as gsap.core.Tween;
    tween.progress(1);
    expect(scrollTo).toHaveBeenLastCalledWith(0, 900);
  });

  it("past the scene the wheel is left alone", () => {
    window.scrollY = 5000;
    detach = attachPager(targets(fakeSmooth(5000)));
    const e = wheelEvent(100);
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });

  it("re-reads its layout when the watch re-measures, and after detach hears nothing", () => {
    const t = targets(fakeSmooth(), []);
    const disable = vi.fn();
    const enable = vi.fn();
    vi.spyOn(Observer, "create").mockImplementation(() => ({ enable, disable, kill: vi.fn() }) as unknown as Observer);
    detach = attachPager(t);
    // no tops yet: nothing to hold
    expect(enable).not.toHaveBeenCalled();
    t.measure([0, 900]);
    expect(enable).toHaveBeenCalledTimes(1);
    detach();
    detach = null;
    const e = wheelEvent(100);
    window.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(false);
  });
});
