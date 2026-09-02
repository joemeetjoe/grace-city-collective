import { afterEach, describe, expect, it, vi } from "vitest";

import { ENGINE_PRELOAD_ATTR, enginePreloadScript } from "./enginePreload";
import { REDUCED_MOTION_QUERY } from "./reducedMotion";

type Signals = { webgl?: boolean; reducedMotion?: boolean; saveData?: boolean };

/** run the inline script in a document whose signals read as given */
function runScript(href: string, { webgl = true, reducedMotion = false, saveData = false }: Signals = {}) {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => (webgl ? ({} as RenderingContext) : null),
  );
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) => ({ matches: reducedMotion && query === REDUCED_MOTION_QUERY }) as MediaQueryList,
  );
  Object.defineProperty(navigator, "connection", { value: { saveData }, configurable: true });
  new Function(enginePreloadScript(href))();
  return document.head.querySelector<HTMLLinkElement>(`link[${ENGINE_PRELOAD_ATTR}]`);
}

afterEach(() => {
  document.head.innerHTML = "";
  vi.restoreAllMocks();
});

describe("enginePreloadScript", () => {
  it("adds a modulepreload for the engine chunk when the scene will render", () => {
    const link = runScript("/assets/engine-abc.js");
    expect(link?.rel).toBe("modulepreload");
    expect(link?.getAttribute("href")).toBe("/assets/engine-abc.js");
    // the bundle's own module scripts are fetched anonymously; a preload with another credentials mode is fetched twice
    expect(link?.getAttribute("crossorigin")).toBe("");
  });

  it("requests nothing when the poster will stand in: no WebGL, reduced motion, or Save-Data", () => {
    expect(runScript("/assets/engine-abc.js", { webgl: false })).toBeNull();
    expect(runScript("/assets/engine-abc.js", { reducedMotion: true })).toBeNull();
    expect(runScript("/assets/engine-abc.js", { saveData: true })).toBeNull();
  });
});

import { engineChunkHref } from "./enginePreload";

describe("engineChunkHref", () => {
  const bundle = {
    "assets/index-abc.js": { type: "chunk", fileName: "assets/index-abc.js", facadeModuleId: "/repo/src/main.tsx" },
    "assets/PentecostParallax-def.js": {
      type: "chunk",
      fileName: "assets/PentecostParallax-def.js",
      facadeModuleId: "/repo/src/engine/PentecostParallax.tsx",
    },
    "assets/index-ghi.css": { type: "asset", fileName: "assets/index-ghi.css" },
  };

  it("finds the chunk the engine's dynamic import produced, under the site's base", () => {
    expect(engineChunkHref(bundle, "/")).toBe("/assets/PentecostParallax-def.js");
    expect(engineChunkHref(bundle, "/grace-city-collective/")).toBe("/grace-city-collective/assets/PentecostParallax-def.js");
  });

  it("is an error when the build emitted no engine chunk", () => {
    expect(() => engineChunkHref({ "assets/index-abc.js": bundle["assets/index-abc.js"] }, "/")).toThrow(/engine chunk/);
  });
});
