import { describe, expect, it } from "vitest";

import * as engine from "./index";
import PentecostParallax from "./PentecostParallax";

describe("the engine barrel", () => {
  it("keeps three.js out of the shell: the scene arrives through loadParallax, the poster and vignette are static", () => {
    // loadParallaxFiber is the #134 spike's entry: a dynamic import behind a build literal, dropped by the default build
    expect(Object.keys(engine).sort()).toEqual(["StaticPoster", "loadParallax", "loadParallaxFiber", "vignetteCss"]);
  });

  it("loadParallax resolves to the parallax scene component", async () => {
    const mod = await engine.loadParallax();
    expect(mod.default).toBe(PentecostParallax);
  });
});
