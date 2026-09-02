import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LG_PX } from "@/theme/breakpoints";
import { BELOW_LG_QUERY, belowLg, readBelowLg, useBelowLg } from "./breakpoint";

afterEach(() => vi.restoreAllMocks());

describe("belowLg", () => {
  it("is Tailwind's lg: 1024 and up is desktop, anything narrower is not", () => {
    expect(belowLg(390)).toBe(true);
    expect(belowLg(768)).toBe(true);
    expect(belowLg(LG_PX - 1)).toBe(true);
    expect(belowLg(LG_PX)).toBe(false);
    expect(belowLg(1920)).toBe(false);
  });

  it("the media query is the complement of lg:", () => {
    expect(BELOW_LG_QUERY).toBe("(max-width: 1023.98px)");
  });
});

describe("readBelowLg", () => {
  it("asks matchMedia when it exists", () => {
    const mm = vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) => ({ matches: true, media: query }) as MediaQueryList,
    );
    expect(readBelowLg()).toBe(true);
    expect(mm).toHaveBeenCalledWith(BELOW_LG_QUERY);
  });

  it("falls back to innerWidth without matchMedia, and to false without a window", () => {
    expect(readBelowLg({ innerWidth: 500 } as Window)).toBe(true);
    expect(readBelowLg({ innerWidth: 1500 } as Window)).toBe(false);
    expect(readBelowLg(undefined)).toBe(false);
  });
});

describe("useBelowLg", () => {
  it("reports the query's answer and follows a change", () => {
    let matches = false;
    let listener: (() => void) | null = null;
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) =>
        ({
          get matches() {
            return matches;
          },
          media: query,
          addEventListener: (_: string, fn: () => void) => {
            listener = fn;
          },
          removeEventListener: () => {
            listener = null;
          },
        }) as unknown as MediaQueryList,
    );
    const { result, unmount } = renderHook(() => useBelowLg());
    expect(result.current).toBe(false);
    matches = true;
    act(() => listener?.());
    expect(result.current).toBe(true);
    unmount();
    expect(listener).toBeNull();
  });
});
