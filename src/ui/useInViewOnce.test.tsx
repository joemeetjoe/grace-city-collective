import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  IN_VIEW_MAX_SHARE,
  cappedThreshold,
  useInViewOnce,
} from "./useInViewOnce";

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;

/** a stand-in observer the test can fire by hand */
function stubObserver() {
  const observers: { cb: Callback; el: Element | null; threshold: unknown }[] =
    [];
  class IO {
    record: (typeof observers)[number];
    constructor(cb: Callback, init?: IntersectionObserverInit) {
      this.record = { cb, el: null, threshold: init?.threshold };
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

function Probe({ threshold, height }: { threshold: number; height: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInViewOnce(ref, threshold);
  return (
    <div
      ref={(el) => {
        ref.current = el;
        if (el)
          el.getBoundingClientRect = () =>
            ({ height, width: 0, top: 0, left: 0 }) as DOMRect;
      }}
      data-seen={String(seen)}
    />
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("cappedThreshold", () => {
  it("keeps a threshold a short block can reach", () => {
    // 20% of 400px is 80px: well under half an 844px screen
    expect(cappedThreshold(0.2, 844, 400)).toBe(0.2);
    // a block exactly IN_VIEW_MAX_SHARE of the viewport is the last to keep it whole
    expect(cappedThreshold(1, 1000, IN_VIEW_MAX_SHARE * 1000)).toBe(1);
  });

  it("caps a tall block so no more than IN_VIEW_MAX_SHARE of a screen of it waits", () => {
    // the beliefs dl at 390×844: 3530px, 20% of it is 706px of blank ink
    const t = cappedThreshold(0.2, 844, 3530);
    expect(t).toBeLessThan(0.2);
    expect(t * 3530).toBeCloseTo(IN_VIEW_MAX_SHARE * 844, 6);
    // the devotions ol, 1608px: 20% is 322px, still under the 338px cap
    expect(cappedThreshold(0.2, 844, 1608)).toBe(0.2);
    // a shorter screen bites sooner
    expect(cappedThreshold(0.2, 667, 1608) * 1608).toBeCloseTo(
      IN_VIEW_MAX_SHARE * 667,
      6,
    );
    // never below zero, never above what was asked
    expect(cappedThreshold(0.2, 844, 100000)).toBeGreaterThan(0);
    expect(cappedThreshold(0, 844, 100000)).toBe(0);
  });

  it("leaves an unmeasurable height or viewport alone", () => {
    expect(cappedThreshold(0.2, 844, 0)).toBe(0.2);
    expect(cappedThreshold(0.2, 0, 3530)).toBe(0.2);
    expect(cappedThreshold(0.2, 844, NaN)).toBe(0.2);
  });
});

describe("useInViewOnce", () => {
  it("watches with the capped threshold, measured from the element and the viewport", () => {
    const observers = stubObserver();
    vi.stubGlobal("innerHeight", 844);
    render(<Probe threshold={0.2} height={3530} />);
    expect(observers.length).toBe(1);
    expect(observers[0].threshold).toBeCloseTo(
      cappedThreshold(0.2, 844, 3530),
      9,
    );
  });

  it("passes a short block's threshold through untouched", () => {
    const observers = stubObserver();
    vi.stubGlobal("innerHeight", 844);
    render(<Probe threshold={0.2} height={300} />);
    expect(observers[0].threshold).toBe(0.2);
  });

  it("is false until seen, then true for good", () => {
    const observers = stubObserver();
    const { container } = render(<Probe threshold={0.2} height={300} />);
    const el = container.firstElementChild!;
    expect(el.getAttribute("data-seen")).toBe("false");
    act(() => observers[0].cb([{ isIntersecting: false }]));
    expect(el.getAttribute("data-seen")).toBe("false");
    act(() => observers[0].cb([{ isIntersecting: true }]));
    expect(el.getAttribute("data-seen")).toBe("true");
  });
});
