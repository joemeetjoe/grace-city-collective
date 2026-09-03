import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("keeps every class it is given, in order, even when two set the same property", () => {
    expect(cn("p-2", "p-4", "text-cream")).toBe("p-2 p-4 text-cream");
  });

  it("drops falsy entries and flattens arrays", () => {
    const off = false as boolean;
    expect(cn("a", off && "b", undefined, null, ["c", off ? "d" : "e"])).toBe("a c e");
  });

  it("joins with single spaces", () => {
    expect(cn("a b", "c")).toBe("a b c");
  });
});
