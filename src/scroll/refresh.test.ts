import { afterEach, describe, expect, it, vi } from "vitest";

import { ScrollTrigger } from "gsap/ScrollTrigger";

import { refreshScrollPositions } from "./refresh";

afterEach(() => vi.restoreAllMocks());

describe("refreshScrollPositions", () => {
  it("re-measures every ScrollTrigger at once, synchronously", () => {
    const refresh = vi.spyOn(ScrollTrigger, "refresh").mockImplementation(() => {});
    refreshScrollPositions();
    expect(refresh).toHaveBeenCalledTimes(1);
    // not the deferred ("safe") refresh: the caller wants the positions now
    expect(refresh.mock.calls[0][0]).toBeUndefined();
  });
});
