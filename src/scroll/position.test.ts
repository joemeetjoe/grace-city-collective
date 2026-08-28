import { afterEach, describe, expect, it } from "vitest";

import { getScrollDriver, getScrollTop, installScrollDriver, readScrollTop, type ScrollDriver } from "./position";

const fakeDriver = (top: number): ScrollDriver => ({ scrollTop: () => top, scrollTo: () => {} });

afterEach(() => installScrollDriver(null));

describe("readScrollTop", () => {
  it("prefers the driver's smoothed position", () => {
    expect(readScrollTop(fakeDriver(1234))).toBe(1234);
  });

  it("falls back to the document's scrollTop without a driver", () => {
    document.documentElement.scrollTop = 77;
    expect(readScrollTop(null)).toBe(document.documentElement.scrollTop);
  });
});

describe("getScrollTop", () => {
  it("reads through whatever driver is installed", () => {
    installScrollDriver(fakeDriver(42));
    expect(getScrollDriver()).not.toBeNull();
    expect(getScrollTop()).toBe(42);
    installScrollDriver(null);
    expect(getScrollDriver()).toBeNull();
    expect(getScrollTop()).toBe(document.documentElement.scrollTop);
  });
});
