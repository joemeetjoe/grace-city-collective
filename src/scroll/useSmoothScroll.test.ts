import { renderHook } from "@testing-library/react";
import { Observer } from "gsap/Observer";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BELOW_LG_QUERY } from "@/layout/breakpoint";
import { REST_STATE, useAppStore } from "@/state/appStore";
import { createSectionRegistry } from "./sections";
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

const SCENE = ["hero", "about"] as const;
const LONGFORM = ["faq"] as const;

/** the smoother's wrapper and content around a scene of sections and a long-form one, on the page, registered by ref */
function mountPage() {
  const wrapper = document.createElement("div");
  const content = document.createElement("div");
  const scene = document.createElement("div");
  const sections = createSectionRegistry([...SCENE, ...LONGFORM]);
  for (const id of SCENE) {
    const section = document.createElement("section");
    section.id = id;
    scene.appendChild(section);
    sections.ref(id)(section);
  }
  content.appendChild(scene);
  for (const id of LONGFORM) {
    const section = document.createElement("section");
    section.id = id;
    content.appendChild(section);
    sections.ref(id)(section);
  }
  wrapper.appendChild(content);
  document.body.appendChild(wrapper);
  return {
    refs: { wrapper: { current: wrapper }, content: { current: content }, scene: { current: scene }, held: [], sections },
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

const sectionTriggers = () => ScrollTrigger.getAll().filter((t) => (t.trigger as HTMLElement).tagName === "SECTION");

describe("useSmoothScroll", () => {
  let page: ReturnType<typeof mountPage>;
  beforeEach(() => {
    page = mountPage();
  });
  afterEach(() => {
    page.unmount();
    ScrollTrigger.killAll();
    useAppStore.setState(REST_STATE);
    vi.restoreAllMocks();
  });

  it("at lg and up the scene is paged: the smoother, a touch observer and the scene's trigger", () => {
    viewportBelowLg(false);
    const smoother = vi.spyOn(ScrollSmoother, "create");
    const observer = vi.spyOn(Observer, "create");
    const trigger = vi.spyOn(ScrollTrigger, "create");
    const { result, unmount } = renderHook(() => useSmoothScroll(page.refs));
    expect(smoother).toHaveBeenCalledTimes(1);
    expect(observer).toHaveBeenCalledTimes(1);
    expect(observer.mock.calls[0][0]).toMatchObject({ type: "touch", preventDefault: true });
    expect(trigger).toHaveBeenCalledWith(expect.objectContaining({ trigger: page.refs.scene.current }));
    expect(document.documentElement.hasAttribute(SMOOTH_SCROLL_ATTR)).toBe(true);
    expect(window.__gcc?.scrollTo).toBeTypeOf("function");
    // the driver is the smoother's, off its handle
    expect(result.current.driver()).not.toBeNull();
    expect(result.current.scrollTop()).toBe(result.current.driver()!.scrollTop());
    unmount();
    expect(document.documentElement.hasAttribute(SMOOTH_SCROLL_ATTR)).toBe(false);
    expect(window.__gcc?.scrollTo).toBeUndefined();
    expect(result.current.driver()).toBeNull();
  });

  it("below lg the scene is not paged — no observer, no scene trigger — but the smoother stands", () => {
    viewportBelowLg(true);
    const smoother = vi.spyOn(ScrollSmoother, "create");
    const observer = vi.spyOn(Observer, "create");
    const trigger = vi.spyOn(ScrollTrigger, "create");
    const { unmount } = renderHook(() => useSmoothScroll(page.refs));
    expect(smoother).toHaveBeenCalledTimes(1);
    expect(observer).not.toHaveBeenCalled();
    expect(trigger).not.toHaveBeenCalledWith(expect.objectContaining({ trigger: page.refs.scene.current }));
    unmount();
  });

  it("reduced motion is native at any width: no smoother, no paging, and the window's own position", () => {
    viewportBelowLg(false);
    useAppStore.setState({ reducedMotion: true });
    const observer = vi.spyOn(Observer, "create");
    const smoother = vi.spyOn(ScrollSmoother, "create");
    const { result, unmount } = renderHook(() => useSmoothScroll(page.refs));
    expect(observer).not.toHaveBeenCalled();
    expect(smoother).not.toHaveBeenCalled();
    expect(document.documentElement.hasAttribute(SMOOTH_SCROLL_ATTR)).toBe(false);
    expect(window.__gcc?.scrollTo).toBeUndefined();
    expect(result.current.driver()).toBeNull();
    expect(result.current.scrollTop()).toBe(document.documentElement.scrollTop);
    unmount();
  });

  it("one trigger per section, scene and long-form, feeds the store's activeId", () => {
    viewportBelowLg(false);
    useAppStore.setState({ activeId: "hero" });
    const { unmount } = renderHook(() => useSmoothScroll(page.refs));
    const triggers = sectionTriggers();
    expect(triggers.map((t) => (t.trigger as HTMLElement).id)).toEqual([...SCENE, ...LONGFORM]);
    triggers[2].vars.onToggle?.({ isActive: true } as ScrollTrigger);
    expect(useAppStore.getState().activeId).toBe("faq");
    unmount();
    expect(sectionTriggers()).toEqual([]);
  });

  it("a resize across lg tears the paging down and builds it back whole, and leaves the smoother and the watch alone", () => {
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
    const smoother = vi.spyOn(ScrollSmoother, "create");
    const { rerender, unmount } = renderHook(() => useSmoothScroll(page.refs));
    expect(observers).toHaveLength(1);
    const watched = sectionTriggers();
    expect(watched).toHaveLength(3);

    below = true;
    onChange!();
    rerender();
    expect(observers[0].kill).toHaveBeenCalledTimes(1);
    expect(observers).toHaveLength(1);

    below = false;
    onChange!();
    rerender();
    expect(observers).toHaveLength(2);
    expect(smoother).toHaveBeenCalledTimes(1);
    expect(sectionTriggers()).toEqual(watched);
    unmount();
    expect(observers[1].kill).toHaveBeenCalledTimes(1);
  });
});
