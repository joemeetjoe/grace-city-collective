import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { site } from "@/content/site";

// the gate re-measures the ScrollTriggers as the words land; count the calls
vi.mock("@/scroll/refresh", () => ({ refreshScrollPositions: vi.fn() }));

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;

/** a stand-in observer the test can fire by hand */
function stubObserver() {
  const observers: { cb: Callback; el: Element | null; init?: IntersectionObserverInit }[] = [];
  class IO {
    record: (typeof observers)[number];
    constructor(cb: Callback, init?: IntersectionObserverInit) {
      this.record = { cb, el: null, init };
      observers.push(this.record);
    }
    observe(el: Element) {
      this.record.el = el;
    }
    disconnect() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", IO);
  return observers;
}

/**
 * The gate and its store afresh: the store remembers the page's one request,
 * so each test takes a new module instance (and imports the store from the
 * same registry as the gate).
 */
async function fresh() {
  vi.resetModules();
  // the mocked module first, on its own: imported alongside the gate, the
  // mock factory can run twice and hand the test and the gate different fns
  const refresh = vi.mocked((await import("@/scroll/refresh")).refreshScrollPositions);
  refresh.mockClear(); // the mock outlives the registry reset
  const [{ default: LongformGate }, store] = await Promise.all([import("./LongformGate"), import("./longformRequest")]);
  return { LongformGate, store, refresh };
}

const ids = site.longform.map((s) => s.id);

afterEach(() => vi.unstubAllGlobals());

describe("LongformGate", () => {
  it("before the trigger fires, the four sections stand with their ids, busy, a viewport tall each, and no words", async () => {
    const observers = stubObserver();
    const { LongformGate } = await fresh();
    const { container } = render(<LongformGate />);
    const sections = Array.from(container.querySelectorAll("[data-longform] section"));
    expect(sections.map((s) => s.id)).toEqual(ids);
    for (const s of sections) {
      expect(s.getAttribute("aria-busy")).toBe("true");
      expect(s.className).toContain("min-h-[100svh]");
      expect(s.querySelector("h2")).toBeNull();
    }
    expect(container.querySelector("footer")).toBeNull();
    // one watch, on the long-form itself, two viewports ahead of the reader
    expect(observers).toHaveLength(1);
    expect(observers[0].el).toBe(container.querySelector("[data-longform]"));
    expect(observers[0].init?.rootMargin).toBe("0px 0px 200% 0px");
  });

  it("once the reader nears, the chunk fills the same sections in and the footer follows", async () => {
    const observers = stubObserver();
    const { LongformGate } = await fresh();
    const { container } = render(<LongformGate />);
    const before = Array.from(container.querySelectorAll("[data-longform] section"));
    act(() => observers[0].cb([{ isIntersecting: true }]));
    await waitFor(() => expect(container.querySelector("footer")).not.toBeNull());
    const after = Array.from(container.querySelectorAll("[data-longform] section"));
    // the very same elements: the ids, boxes and ScrollTriggers never change hands
    expect(after).toEqual(before);
    for (const [i, s] of after.entries()) {
      expect(s.querySelector("h2")?.textContent).toContain(site.longform[i].heading);
      expect(s.getAttribute("aria-busy")).toBeNull();
      expect(s.className).not.toContain("min-h-");
    }
  });

  it("a request through the store fills the sections in too, and resolves once they are, their ScrollTriggers re-measured", async () => {
    stubObserver();
    const { LongformGate, store, refresh } = await fresh();
    const { container } = render(<LongformGate />);
    expect(container.querySelector("#faq dl")).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
    let dlAtLanding: Element | null | undefined;
    let refreshedAtLanding: number | undefined;
    let landing!: Promise<void>;
    act(() => {
      landing = store.requestLongform().then(() => {
        dlAtLanding = container.querySelector("#faq dl");
        refreshedAtLanding = refresh.mock.calls.length;
      });
    });
    await waitFor(() => expect(container.querySelector("#faq dl")).not.toBeNull());
    await landing;
    expect(dlAtLanding).not.toBeNull();
    // the sections grew before the jump could land, and were re-measured once
    expect(refreshedAtLanding).toBe(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(store.isLongformMounted()).toBe(true);
  });

  it("without IntersectionObserver (jsdom, old engines) nothing waits: the words come at once", async () => {
    const { LongformGate } = await fresh();
    const { container } = render(<LongformGate />);
    await waitFor(() => expect(container.querySelector("#faq dl")).not.toBeNull());
  });
});
