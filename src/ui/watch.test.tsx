import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { createWatch, useWatch } from "./watch";

describe("createWatch", () => {
  it("starts the source for the first subscriber, tells each of a change, and stops after the last", () => {
    let emit: ((n: number) => void) | null = null;
    const stop = vi.fn();
    const start = vi.fn((set: (n: number) => void) => {
      emit = set;
      return stop;
    });
    const watch = createWatch(0, start);
    expect(watch.getSnapshot()).toBe(0);
    expect(start).not.toHaveBeenCalled();

    const a = vi.fn();
    const b = vi.fn();
    const stopA = watch.subscribe(a);
    const stopB = watch.subscribe(b);
    expect(start).toHaveBeenCalledTimes(1);
    emit!(1);
    expect(watch.getSnapshot()).toBe(1);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    // the same value again is no change
    emit!(1);
    expect(a).toHaveBeenCalledTimes(1);

    stopA();
    expect(stop).not.toHaveBeenCalled();
    stopB();
    expect(stop).toHaveBeenCalledTimes(1);
    // the value survives the stop, and a new subscriber starts the source over
    expect(watch.getSnapshot()).toBe(1);
    watch.subscribe(() => {});
    expect(start).toHaveBeenCalledTimes(2);
  });
});

describe("useWatch", () => {
  it("renders the watch's value and re-renders on each change while mounted", () => {
    let emit: ((s: string) => void) | null = null;
    const stop = vi.fn();
    const watch = createWatch("rest", (set) => {
      emit = set;
      return stop;
    });
    function Probe() {
      return <div data-value={useWatch(watch)} />;
    }
    const { container, unmount } = render(<Probe />);
    const el = container.firstElementChild!;
    expect(el.getAttribute("data-value")).toBe("rest");
    act(() => emit!("lit"));
    expect(el.getAttribute("data-value")).toBe("lit");
    unmount();
    expect(stop).toHaveBeenCalled();
  });
});
