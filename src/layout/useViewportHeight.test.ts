import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { readViewportHeight, useViewportHeight } from "./useViewportHeight";

afterEach(() => vi.restoreAllMocks());

function setInnerHeight(px: number) {
  Object.defineProperty(window, "innerHeight", {
    value: px,
    configurable: true,
    writable: true,
  });
}

describe("readViewportHeight", () => {
  it("reads the window's layout height, and null without a window", () => {
    setInnerHeight(700);
    expect(readViewportHeight()).toBe(700);
    expect(readViewportHeight(null)).toBeNull();
  });
});

describe("useViewportHeight", () => {
  it("enabled, it reports the height and follows a resize", () => {
    setInnerHeight(700);
    const { result } = renderHook(() => useViewportHeight(true));
    expect(result.current).toBe(700);
    setInnerHeight(760);
    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(760);
  });

  it("disabled, it is null and listens for nothing", () => {
    const listen = vi.spyOn(window, "addEventListener");
    const { result } = renderHook(() => useViewportHeight(false));
    expect(result.current).toBeNull();
    expect(listen).not.toHaveBeenCalledWith("resize", expect.anything());
  });

  it("unmounting removes the resize listener", () => {
    const drop = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useViewportHeight(true));
    unmount();
    expect(drop).toHaveBeenCalledWith("resize", expect.any(Function));
  });
});
