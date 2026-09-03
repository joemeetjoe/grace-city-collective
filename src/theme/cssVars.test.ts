import { describe, expect, it } from "vitest";

import { cssVars } from "./cssVars";

describe("cssVars", () => {
  it("keeps custom properties beside the named ones, in the order given", () => {
    const style = cssVars({ strokeDasharray: 12, "--len": 12, transitionDelay: "100ms" });
    expect(Object.keys(style)).toEqual(["strokeDasharray", "--len", "transitionDelay"]);
    expect(style).toEqual({ strokeDasharray: 12, "--len": 12, transitionDelay: "100ms" });
  });

  it("is typed: only custom properties may be unknown names", () => {
    // @ts-expect-error a misspelt named property is refused
    expect(cssVars({ transitionDelays: "1ms" })).toBeTruthy();
    expect(cssVars({ "--anything": 1 })).toEqual({ "--anything": 1 });
  });
});
