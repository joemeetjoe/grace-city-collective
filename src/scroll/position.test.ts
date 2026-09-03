import { describe, expect, it } from "vitest";

import { readScrollTop, type ScrollDriver } from "./position";

const fakeDriver = (top: number): ScrollDriver => ({ scrollTop: () => top, scrollTo: () => {} });

describe("readScrollTop", () => {
  it("reads through the driver it is given, and the document's own scrollTop without one", () => {
    expect(readScrollTop(fakeDriver(42))).toBe(42);
    expect(readScrollTop(null)).toBe(document.documentElement.scrollTop);
  });
});
