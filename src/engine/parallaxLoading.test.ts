import { describe, expect, it, vi } from "vitest";

import { readyOnce } from "./parallaxLoading";

describe("readyOnce", () => {
  it("reports readiness once even if the loading manager fires twice", () => {
    const onReady = vi.fn();
    const ready = readyOnce(onReady);
    ready();
    ready();
    expect(onReady).toHaveBeenCalledTimes(1);
  });

  it("tolerates having no listener", () => {
    expect(() => readyOnce(undefined)()).not.toThrow();
  });
});
