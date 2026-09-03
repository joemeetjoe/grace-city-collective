import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useWayStep, walkTo } from "./useWayStep";

describe("walkTo", () => {
  it("keeps the stand when the step is the one already stood on", () => {
    const stand = { step: 2, dir: "next" as const };
    expect(walkTo(stand, 2)).toBe(stand);
  });

  it("derives the way walked from the change: on for a higher step, back for a lower", () => {
    expect(walkTo({ step: 0 }, 1)).toEqual({ step: 1, dir: "next" });
    expect(walkTo({ step: 3, dir: "next" }, 1)).toEqual({ step: 1, dir: "back" });
  });
});

describe("useWayStep", () => {
  it("starts on the first step with no walk behind it, and walks by the setter", () => {
    const { result } = renderHook(() => useWayStep());
    expect(result.current[0]).toEqual({ step: 0 });
    act(() => result.current[1](2));
    expect(result.current[0]).toEqual({ step: 2, dir: "next" });
    act(() => result.current[1](1));
    expect(result.current[0]).toEqual({ step: 1, dir: "back" });
  });

  it("starts where it is told, and its setter holds identity across renders", () => {
    const { result, rerender } = renderHook(() => useWayStep(3));
    expect(result.current[0]).toEqual({ step: 3 });
    const onStep = result.current[1];
    rerender();
    expect(result.current[1]).toBe(onStep);
    act(() => onStep(3));
    expect(result.current[0]).toEqual({ step: 3 });
  });
});
