import { act, render } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  bandMargin,
  PLAY_BAND,
  PLAY_MARGIN,
  useInView,
  type InViewOptions,
} from "./useInView";

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void;

/** a stand-in observer the test can fire by hand */
function stubObserver() {
  const observers: {
    cb: Callback;
    el: Element | null;
    init?: IntersectionObserverInit;
    disconnected: boolean;
  }[] = [];
  class IO {
    record: (typeof observers)[number];
    constructor(cb: Callback, init?: IntersectionObserverInit) {
      this.record = { cb, el: null, init, disconnected: false };
      observers.push(this.record);
    }
    observe(el: Element) {
      this.record.el = el;
    }
    disconnect() {
      this.record.disconnected = true;
    }
    unobserve() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal("IntersectionObserver", IO);
  return observers;
}

function Probe(options: InViewOptions) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, options);
  return <div ref={ref} data-in-view={String(inView)} />;
}

afterEach(() => vi.unstubAllGlobals());

describe("bandMargin", () => {
  it("cuts shares of the viewport off its top and foot, as a rootMargin", () => {
    expect(bandMargin(0.1, 0.33)).toBe("-10% 0px -33% 0px");
    expect(bandMargin(0, 0)).toBe("-0% 0px -0% 0px");
    // the play band: settled once a seventh of the way up, gone once a tenth from the top
    expect(PLAY_MARGIN).toBe(bandMargin(PLAY_BAND.top, PLAY_BAND.bottom));
    expect(PLAY_BAND.bottom).toBeGreaterThan(PLAY_BAND.top);
  });
});

describe("useInView", () => {
  it("is false until the element is in view, true while it is, and false again once it leaves", () => {
    const observers = stubObserver();
    const { container } = render(<Probe rootMargin={PLAY_MARGIN} />);
    const el = container.firstElementChild!;
    expect(observers).toHaveLength(1);
    expect(observers[0].el).toBe(el);
    expect(observers[0].init).toEqual({ threshold: 0, rootMargin: PLAY_MARGIN });
    expect(el.getAttribute("data-in-view")).toBe("false");
    act(() => observers[0].cb([{ isIntersecting: true }]));
    expect(el.getAttribute("data-in-view")).toBe("true");
    act(() => observers[0].cb([{ isIntersecting: false }]));
    expect(el.getAttribute("data-in-view")).toBe("false");
    act(() => observers[0].cb([{ isIntersecting: true }]));
    expect(el.getAttribute("data-in-view")).toBe("true");
  });

  it("reports `initial` until the observer answers, and passes the threshold through", () => {
    const observers = stubObserver();
    const { container } = render(<Probe initial threshold={0.45} />);
    const el = container.firstElementChild!;
    expect(el.getAttribute("data-in-view")).toBe("true");
    expect(observers[0].init?.threshold).toBe(0.45);
    act(() => observers[0].cb([{ isIntersecting: false }]));
    expect(el.getAttribute("data-in-view")).toBe("false");
  });

  it("starts a fresh watch from `initial` when its options change, letting the old one go", () => {
    const observers = stubObserver();
    const { container, rerender } = render(<Probe initial threshold={0.45} />);
    const el = container.firstElementChild!;
    act(() => observers[0].cb([{ isIntersecting: false }]));
    expect(el.getAttribute("data-in-view")).toBe("false");
    rerender(<Probe initial rootMargin={PLAY_MARGIN} />);
    expect(observers[0].disconnected).toBe(true);
    expect(observers).toHaveLength(2);
    expect(observers[1].init).toEqual({ threshold: 0, rootMargin: PLAY_MARGIN });
    expect(el.getAttribute("data-in-view")).toBe("true");
  });

  it("reports `initial` for good wherever IntersectionObserver is missing", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container } = render(
      <>
        <Probe />
        <Probe initial />
      </>,
    );
    const [rest, shown] = container.children;
    expect(rest.getAttribute("data-in-view")).toBe("false");
    expect(shown.getAttribute("data-in-view")).toBe("true");
  });
});
