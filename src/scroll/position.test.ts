import { afterEach, describe, expect, it } from "vitest";

import { getScrollDriver, getScrollTop, installScrollDriver, type ScrollDriver } from "./position";

const fakeDriver = (top: number): ScrollDriver => ({ scrollTop: () => top, scrollTo: () => {} });

afterEach(() => installScrollDriver(null));

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
