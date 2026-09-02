import { describe, expect, it } from "vitest";

import * as engine from "./index";
import PentecostParallax from "./PentecostParallax";

describe("the engine barrel", () => {
  it("keeps three.js out of the shell: the scene arrives through loadParallax; the poster, the vignette and the error report are static", () => {
    expect(Object.keys(engine).sort()).toEqual(["StaticPoster", "loadParallax", "reportSceneError", "vignetteCss"]);
  });

  it("loadParallax resolves to the parallax scene component", async () => {
    const mod = await engine.loadParallax();
    expect(mod.default).toBe(PentecostParallax);
  });
});
