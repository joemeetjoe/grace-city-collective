import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BELOW_LG_QUERY } from "@/layout/breakpoint";
import { Observer, ScrollSmoother, ScrollTrigger } from "@/lib/gsap";
import { REST_STATE, useAppStore } from "@/state/appStore";
import { installScrollDriver } from "./position";
import { SMOOTH_SCROLL_ATTR } from "./smoother";

import { scrollMode, useSmoothScroll } from "./useSmoothScroll";

describe("scrollMode", () => {
  it("pages the desktop", () => {
    expect(scrollMode({ reducedMotion: false, belowLg: false })).toBe("paged");
  });

  it("is native below lg: the finger moves the page by its own measure", () => {
    expect(scrollMode({ reducedMotion: false, belowLg: true })).toBe("native");
  });

  it("is native under reduced motion, at any width", () => {
    expect(scrollMode({ reducedMotion: true, belowLg: false })).toBe("native");
    expect(scrollMode({ reducedMotion: true, belowLg: true })).toBe("native");
  });
});

/** the smoother's wrapper and content around a scene of labelled sections, on the page */
function mountPage() {
  const wrapper = document.createElement("div");
  const content = document.createElement("div");
  const scene = document.createElement("div");
  for (const label of ["Hero", "About"]) {
    const section = document.createElement("section");
    section.dataset.screenLabel = label;
    scene.appendChild(section);
  }
  content.appendChild(scene);
  wrapper.appendChild(content);
  document.body.appendChild(wrapper);
  return {
    refs: { wrapper: { current: wrapper }, content: { current: content }, scene: { current: scene }, held: [] },
    unmount: () => wrapper.remove(),
  };
}

/** what matchMedia answers for the below-lg query; every other query is false */
function viewportBelowLg(below: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: query === BELOW_LG_QUERY && below,
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

describe("useSmoothScroll", () => {
  let page: ReturnType<typeof mountPage>;
  beforeEach(() => {
    page = mountPage();
  });
  afterEach(() => {
    page.unmount();
    installScrollDriver(null);
    useAppStore.setState(REST_STATE);
    vi.restoreAllMocks();
  });

  it("below lg builds nothing: no smoother, no observer, no settle trigger — the window scrolls", () => {
    viewportBelowLg(true);
    const smoother = vi.spyOn(ScrollSmoother, "create");
    const observer = vi.spyOn(Observer, "create");
    const trigger = vi.spyOn(ScrollTrigger, "create");
    const { unmount } = renderHook(() => useSmoothScroll(page.refs));
    expect(smoother).not.toHaveBeenCalled();
    expect(observer).not.toHaveBeenCalled();
    expect(trigger).not.toHaveBeenCalled();
    expect(document.documentElement.hasAttribute(SMOOTH_SCROLL_ATTR)).toBe(false);
    expect(window.__gcc?.scrollTo).toBeUndefined();
    unmount();
  });

  it("at lg and up the scene is paged: a touch observer and the settle trigger over the scene", () => {
    viewportBelowLg(false);
    const observer = vi.spyOn(Observer, "create");
    const trigger = vi.spyOn(ScrollTrigger, "create");
    const { unmount } = renderHook(() => useSmoothScroll(page.refs));
    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer.mock.calls[0][0]).toMatchObject({ type: "touch", preventDefault: true });
    expect(trigger).toHaveBeenCalledWith(expect.objectContaining({ trigger: page.refs.scene.current }));
    unmount();
  });

  it("reduced motion is native at any width", () => {
    viewportBelowLg(false);
    useAppStore.setState({ reducedMotion: true });
    const observer = vi.spyOn(Observer, "create");
    const smoother = vi.spyOn(ScrollSmoother, "create");
    const { unmount } = renderHook(() => useSmoothScroll(page.refs));
    expect(observer).not.toHaveBeenCalled();
    expect(smoother).not.toHaveBeenCalled();
    unmount();
  });

  it("a resize across lg tears the paging down, and builds it back whole", () => {
    let below = false;
    let onChange: (() => void) | null = null;
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          get matches() {
            return query === BELOW_LG_QUERY && below;
          },
          media: query,
          addEventListener: (_: string, fn: () => void) => {
            if (query === BELOW_LG_QUERY) onChange = fn;
          },
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    const observers: Array<{ kill: ReturnType<typeof vi.fn> }> = [];
    vi.spyOn(Observer, "create").mockImplementation(() => {
      const fake = { kill: vi.fn(), enable: vi.fn(), disable: vi.fn() };
      observers.push(fake);
      return fake as unknown as Observer;
    });
    const { rerender, unmount } = renderHook(() => useSmoothScroll(page.refs));
    expect(observers).toHaveLength(1);

    below = true;
    onChange!();
    rerender();
    expect(observers[0].kill).toHaveBeenCalledTimes(1);
    expect(observers).toHaveLength(1);

    below = false;
    onChange!();
    rerender();
    expect(observers).toHaveLength(2);
    unmount();
    expect(observers[1].kill).toHaveBeenCalledTimes(1);
  });
});
