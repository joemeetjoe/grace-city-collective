import { afterEach, describe, expect, it, vi } from "vitest";

import { hashFor, idFromHash, replaceHash, throttleLatest, type Clock } from "./hash";

const ids = ["hero", "about", "give", "faq"];

/** a clock the test advances by hand: `after` fires when `tick` passes its time */
function fakeClock() {
  let now = 1000;
  const timers: Array<{ at: number; fn: () => void }> = [];
  const clock: Clock = {
    now: () => now,
    after(ms, fn) {
      const timer = { at: now + ms, fn };
      timers.push(timer);
      return () => {
        const i = timers.indexOf(timer);
        if (i > -1) timers.splice(i, 1);
      };
    },
  };
  return {
    clock,
    tick(ms: number) {
      now += ms;
      for (const t of [...timers].sort((a, b) => a.at - b.at)) {
        if (t.at > now) break;
        timers.splice(timers.indexOf(t), 1);
        t.fn();
      }
    },
    pending: () => timers.length,
  };
}

afterEach(() => {
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

describe("hashFor", () => {
  it("names a section as `#id`", () => {
    expect(hashFor("give", "hero")).toBe("#give");
  });

  it("gives the top of the page no hash at all, so a shared link to the top is the bare path", () => {
    expect(hashFor("hero", "hero")).toBe("");
  });
});

describe("idFromHash", () => {
  it("reads a listed section off its hash", () => {
    expect(idFromHash("#give", ids)).toBe("give");
    expect(idFromHash("#faq", ids)).toBe("faq");
  });

  it("reads the bare path (no hash, or an empty one) as the top of the page", () => {
    expect(idFromHash("", ids)).toBe("hero");
    expect(idFromHash("#", ids)).toBe("hero");
  });

  it("knows nothing of a hash that names no section", () => {
    expect(idFromHash("#nowhere", ids)).toBeNull();
    expect(idFromHash("give", ids)).toBeNull();
  });

  it("has no top to read without sections", () => {
    expect(idFromHash("", [])).toBeNull();
  });
});

describe("replaceHash", () => {
  it("replaces the hash in place, keeping the path and the query, and never pushes an entry", () => {
    window.history.replaceState(null, "", "/?ref=card");
    const push = vi.spyOn(window.history, "pushState");
    const replace = vi.spyOn(window.history, "replaceState");
    expect(replaceHash("#give")).toBe(true);
    expect(window.location.hash).toBe("#give");
    expect(window.location.search).toBe("?ref=card");
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(null, "", "/?ref=card#give");
    expect(push).not.toHaveBeenCalled();
  });

  it("clears the hash for the bare path", () => {
    window.history.replaceState(null, "", "/#give");
    expect(replaceHash("")).toBe(true);
    expect(window.location.hash).toBe("");
    expect(window.location.href.endsWith("#")).toBe(false);
  });

  it("writes nothing when the hash is already the one asked for", () => {
    window.history.replaceState(null, "", "/#give");
    const replace = vi.spyOn(window.history, "replaceState");
    expect(replaceHash("#give")).toBe(false);
    expect(replaceHash("")).toBe(true);
    expect(replaceHash("")).toBe(false);
    expect(replace).toHaveBeenCalledTimes(1);
  });
});

describe("throttleLatest", () => {
  it("writes the first value at once", () => {
    const { clock } = fakeClock();
    const write = vi.fn();
    const throttled = throttleLatest(write, 250, clock);
    throttled.push("#about");
    expect(write).toHaveBeenCalledWith("#about");
  });

  it("holds the values that follow within the window and writes the latest once it closes", () => {
    const { clock, tick, pending } = fakeClock();
    const write = vi.fn();
    const throttled = throttleLatest(write, 250, clock);
    throttled.push("#about");
    tick(100);
    throttled.push("#give");
    tick(50);
    throttled.push("#faq");
    expect(write).toHaveBeenCalledTimes(1);
    expect(pending()).toBe(1);
    tick(100);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith("#faq");
  });

  it("opens a new window after the trailing write, so the next lone value goes at once", () => {
    const { clock, tick } = fakeClock();
    const write = vi.fn();
    const throttled = throttleLatest(write, 250, clock);
    throttled.push("#about");
    tick(100);
    throttled.push("#give");
    tick(150);
    expect(write).toHaveBeenCalledTimes(2);
    tick(250);
    throttled.push("#faq");
    expect(write).toHaveBeenCalledTimes(3);
    expect(write).toHaveBeenLastCalledWith("#faq");
  });

  it("writes at once again once the window has long passed", () => {
    const { clock, tick } = fakeClock();
    const write = vi.fn();
    const throttled = throttleLatest(write, 250, clock);
    throttled.push("#about");
    tick(1000);
    throttled.push("#give");
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("cancel drops the held value and its timer", () => {
    const { clock, tick, pending } = fakeClock();
    const write = vi.fn();
    const throttled = throttleLatest(write, 250, clock);
    throttled.push("#about");
    throttled.push("#give");
    throttled.cancel();
    expect(pending()).toBe(0);
    tick(500);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("runs on the wall clock by default", () => {
    vi.useFakeTimers();
    const write = vi.fn();
    const throttled = throttleLatest(write, 250);
    throttled.push("#about");
    throttled.push("#give");
    expect(write).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(250);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write).toHaveBeenLastCalledWith("#give");
    vi.useRealTimers();
  });
});
