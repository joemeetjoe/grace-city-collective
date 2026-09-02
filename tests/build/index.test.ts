import { describe, expect, it } from "vitest";

import { distIndexHtml } from "./dist";
import { splashPrecedesBodyScripts } from "./splashOrder";

describe("dist/index.html", () => {
  it("puts the static splash on screen before any body script runs", () => {
    // The splash is the first element in <body>; every <script> in the body
    // (its own reset, anything later) follows it. Scripts in <head> paint
    // nothing, so the first paint is the splash whatever they do.
    expect(splashPrecedesBodyScripts(distIndexHtml())).toBe(true);
  });
});
