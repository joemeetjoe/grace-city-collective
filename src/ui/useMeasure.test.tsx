import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useMeasure } from "./useMeasure";

/** a stand-in ResizeObserver the test can fire by hand */
function stubResizeObserver() {
  const observers: { cb: () => void; el: Element | null; disconnected: boolean }[] = [];
  class RO {
    record: (typeof observers)[number];
    constructor(cb: () => void) {
      this.record = { cb, el: null, disconnected: false };
      observers.push(this.record);
    }
    observe(el: Element) {
      this.record.el = el;
    }
    disconnect() {
      this.record.disconnected = true;
    }
    unobserve() {}
  }
  vi.stubGlobal("ResizeObserver", RO);
  return observers;
}

/** the element's height, as the block under test would read it */
const readHeight = (el: HTMLDivElement): number => el.getBoundingClientRect().height;

/** a probe whose element reports whatever `size` holds at the time of the read */
function Probe({ size }: { size: { height: number } }) {
  const [attach, height] = useMeasure<HTMLDivElement, number | null>(readHeight, null);
  return (
    <div
      ref={(el) => {
        if (el) el.getBoundingClientRect = () => ({ height: size.height }) as DOMRect;
        attach(el);
      }}
      data-height={String(height)}
    />
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("useMeasure", () => {
  it("measures the element it is attached to before the first paint, and again on every resize it reports", () => {
    const observers = stubResizeObserver();
    const size = { height: 120 };
    const { container, unmount } = render(<Probe size={size} />);
    const el = container.firstElementChild!;
    // the first commit already carries the measure: no frame shows `initial`
    expect(el.getAttribute("data-height")).toBe("120");
    expect(observers).toHaveLength(1);
    expect(observers[0].el).toBe(el);
    size.height = 200;
    act(() => observers[0].cb());
    expect(el.getAttribute("data-height")).toBe("200");
    unmount();
    expect(observers[0].disconnected).toBe(true);
  });

  it("falls back to the window's resize where ResizeObserver is missing", () => {
    vi.stubGlobal("ResizeObserver", undefined);
    const size = { height: 40 };
    const { container, unmount } = render(<Probe size={size} />);
    const el = container.firstElementChild!;
    expect(el.getAttribute("data-height")).toBe("40");
    size.height = 64;
    fireEvent(window, new Event("resize"));
    expect(el.getAttribute("data-height")).toBe("64");
    unmount();
    size.height = 99;
    // unlistened: a resize after the mount reads nothing
    expect(() => fireEvent(window, new Event("resize"))).not.toThrow();
  });
});
