import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useInTurn } from "./useInTurn";

function Probe({ on, count = 3 }: { on: boolean; count?: number }) {
  const lit = useInTurn(on, count, 100, 50);
  return <div data-lit={lit} />;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useInTurn", () => {
  it("lights nothing while off, then one after the next once on, and all go out together", () => {
    const { container, rerender } = render(<Probe on={false} />);
    const el = container.firstElementChild!;
    expect(el.getAttribute("data-lit")).toBe("0");
    act(() => vi.advanceTimersByTime(1000));
    expect(el.getAttribute("data-lit")).toBe("0");

    rerender(<Probe on />);
    expect(el.getAttribute("data-lit")).toBe("0");
    act(() => vi.advanceTimersByTime(50));
    expect(el.getAttribute("data-lit")).toBe("1");
    act(() => vi.advanceTimersByTime(100));
    expect(el.getAttribute("data-lit")).toBe("2");
    act(() => vi.advanceTimersByTime(100));
    expect(el.getAttribute("data-lit")).toBe("3");
    act(() => vi.advanceTimersByTime(1000));
    expect(el.getAttribute("data-lit")).toBe("3");

    rerender(<Probe on={false} />);
    expect(el.getAttribute("data-lit")).toBe("0");
    // on again: the sequence starts over from the first
    rerender(<Probe on />);
    act(() => vi.advanceTimersByTime(50));
    expect(el.getAttribute("data-lit")).toBe("1");
  });

  it("stops the sequence where it is when turned off part-way", () => {
    const { container, rerender } = render(<Probe on />);
    const el = container.firstElementChild!;
    act(() => vi.advanceTimersByTime(150));
    expect(el.getAttribute("data-lit")).toBe("2");
    rerender(<Probe on={false} />);
    act(() => vi.advanceTimersByTime(1000));
    expect(el.getAttribute("data-lit")).toBe("0");
  });
});
