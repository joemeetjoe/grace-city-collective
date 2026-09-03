import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sectionIds, site, type SectionId } from "@/content/site";
import { markLongformMounted } from "@/features/longform/longformRequest";
import type { ScrollDriver } from "@/scroll/position";
import { REST_STATE, useAppStore } from "@/state/appStore";
import { HASH_THROTTLE_MS } from "@/theme/motion";

import { createJump, type JumpTo } from "./jump";
import { READER_GESTURES, useHashSync } from "./useHashSync";

const ids = sectionIds(site);

function section(id: string, top: number) {
  const el = document.createElement("section");
  el.id = id;
  el.getBoundingClientRect = () => ({ top }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

/** mount the hook over a fake jump; the store starts past the intro at the top unless the test says otherwise */
function mount(jump: JumpTo = vi.fn(), state: Partial<typeof REST_STATE> = {}) {
  useAppStore.setState({ ...REST_STATE, activeId: "hero", ...state });
  const rendered = renderHook(() => useHashSync(jump, ids));
  return { jump, go: rendered.result.current, ...rendered };
}

const setActive = (id: SectionId | null) => act(() => useAppStore.getState().setActiveId(id));

let replace: ReturnType<typeof vi.spyOn>;
let push: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState(null, "", "/");
  replace = vi.spyOn(window.history, "replaceState");
  push = vi.spyOn(window.history, "pushState");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  useAppStore.setState(REST_STATE);
  document.body.innerHTML = "";
});

describe("useHashSync: the nav's jumps", () => {
  it("hands back a jump that sets the hash without a page jump and then jumps, once per provided jump", () => {
    const jump = vi.fn();
    const { go, rerender, result } = mount(jump);
    act(() => go("faq"));
    expect(window.location.hash).toBe("#faq");
    expect(jump).toHaveBeenCalledWith("faq", undefined);
    expect(push).not.toHaveBeenCalled();
    rerender();
    expect(result.current).toBe(go);
  });

  it("jumping to the top clears the hash to the bare path", () => {
    window.history.replaceState(null, "", "/?ref=card#faq");
    const { go } = mount();
    act(() => go("hero"));
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("?ref=card");
  });

  it("ignores the sections passed on the way to a jump's target, and follows the hand again once it lands", () => {
    const { go } = mount();
    act(() => go("faq"));
    replace.mockClear();
    setActive("about");
    setActive("give");
    expect(replace).not.toHaveBeenCalled();
    expect(window.location.hash).toBe("#faq");
    setActive("faq");
    expect(replace).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(HASH_THROTTLE_MS));
    setActive("messages");
    expect(window.location.hash).toBe("#messages");
  });

  it("a jump lands at once when the section asked for is already the active one", () => {
    const { go } = mount(vi.fn(), { activeId: "give" });
    act(() => go("give"));
    setActive("visit");
    expect(window.location.hash).toBe("#visit");
  });

  it.each(READER_GESTURES)("the reader taking the scroll back (%s) ends a jump's flight", (type) => {
    const { go } = mount();
    act(() => go("faq"));
    act(() => {
      window.dispatchEvent(new Event(type));
    });
    setActive("about");
    expect(window.location.hash).toBe("#about");
  });

  it("a jump drops a hash write still held by the throttle, so it never lands over the target's", () => {
    const { go } = mount();
    setActive("about");
    setActive("house-churches");
    expect(window.location.hash).toBe("#about");
    act(() => go("faq"));
    act(() => vi.advanceTimersByTime(HASH_THROTTLE_MS * 2));
    expect(window.location.hash).toBe("#faq");
  });
});

describe("useHashSync: scrolling by hand", () => {
  it("follows the active section with replaceState, and never pushState", () => {
    mount();
    setActive("about");
    expect(window.location.hash).toBe("#about");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("writes the first change at once and the latest of a fast run when the window closes", () => {
    mount();
    setActive("about");
    setActive("house-churches");
    setActive("gatherings");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(window.location.hash).toBe("#about");
    act(() => vi.advanceTimersByTime(HASH_THROTTLE_MS));
    expect(replace).toHaveBeenCalledTimes(2);
    expect(window.location.hash).toBe("#gatherings");
  });

  it("back at the top the hash is cleared to the bare path", () => {
    mount();
    setActive("about");
    act(() => vi.advanceTimersByTime(HASH_THROTTLE_MS));
    setActive("hero");
    expect(window.location.hash).toBe("");
    expect(window.location.href.endsWith("#")).toBe(false);
  });

  it("never writes while the splash is up, and follows again once it has gone", () => {
    mount(vi.fn(), { intro: true });
    setActive("about");
    setActive("give");
    act(() => vi.advanceTimersByTime(HASH_THROTTLE_MS));
    expect(replace).not.toHaveBeenCalled();
    act(() => useAppStore.getState().finishIntro());
    expect(replace).not.toHaveBeenCalled();
    setActive("visit");
    expect(window.location.hash).toBe("#visit");
  });

  it("writes nothing for no section, and nothing for a change in another fact", () => {
    mount();
    setActive(null);
    act(() => useAppStore.getState().markReady());
    expect(replace).not.toHaveBeenCalled();
  });

  it("stops following once unmounted", () => {
    const { unmount } = mount();
    unmount();
    setActive("about");
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("useHashSync: arriving with a hash", () => {
  it("reload lands: a hash on arrival scrolls there at once through the page's driver, with no intro to wait for", () => {
    section("hero", 0);
    section("give", 4000);
    const driver: ScrollDriver = { scrollTop: () => 0, scrollTo: vi.fn() };
    window.history.replaceState(null, "", "/#give");
    mount(createJump(site, { driver: () => driver }));
    expect(driver.scrollTo).toHaveBeenCalledTimes(1);
    expect(driver.scrollTo).toHaveBeenCalledWith(4000, false);
    expect(window.location.hash).toBe("#give");
  });

  it("a long-form section on arrival waits for its chunk, then lands at once", async () => {
    section("hero", 0);
    section("faq", 9000);
    const driver: ScrollDriver = { scrollTop: () => 0, scrollTo: vi.fn() };
    window.history.replaceState(null, "", "/#faq");
    mount(createJump(site, { driver: () => driver }));
    expect(driver.scrollTo).not.toHaveBeenCalled();
    markLongformMounted();
    await act(async () => {
      await Promise.resolve();
    });
    expect(driver.scrollTo).toHaveBeenCalledWith(9000, false);
  });

  it("with the intro playing, the landing waits for the splash to go", () => {
    const jump = vi.fn();
    window.history.replaceState(null, "", "/#give");
    mount(jump, { intro: true });
    expect(jump).not.toHaveBeenCalled();
    act(() => useAppStore.getState().finishIntro());
    expect(jump).toHaveBeenCalledTimes(1);
    expect(jump).toHaveBeenCalledWith("give", { immediate: true });
  });

  it("unmounted before the splash goes, it lands nowhere", () => {
    const jump = vi.fn();
    window.history.replaceState(null, "", "/#give");
    const { unmount } = mount(jump, { intro: true });
    unmount();
    act(() => useAppStore.getState().finishIntro());
    expect(jump).not.toHaveBeenCalled();
  });

  it("the bare path, the top's own hash, and a hash that names no section land nowhere", () => {
    for (const url of ["/", "/#hero", "/#nowhere"]) {
      const jump = vi.fn();
      window.history.replaceState(null, "", url);
      const { unmount } = mount(jump);
      expect(jump, url).not.toHaveBeenCalled();
      unmount();
    }
  });
});

describe("useHashSync: the hash changed under the page", () => {
  it("a hash the reader typed, or came back to, jumps to its section", () => {
    const jump = vi.fn();
    mount(jump);
    window.history.replaceState(null, "", "/#faq");
    replace.mockClear();
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(jump).toHaveBeenCalledWith("faq", undefined);
    // the hash already reads so: nothing to write
    expect(replace).not.toHaveBeenCalled();
  });

  it("the bare path come back to jumps to the top; a hash that names no section is left alone", () => {
    const jump = vi.fn();
    mount(jump);
    window.history.replaceState(null, "", "/#faq");
    replace.mockClear();
    window.history.replaceState(null, "", "/");
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(jump).toHaveBeenCalledWith("hero", undefined);
    window.history.replaceState(null, "", "/#nowhere");
    jump.mockClear();
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });
    expect(jump).not.toHaveBeenCalled();
  });
});
