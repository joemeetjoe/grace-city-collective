import { describe, expect, it } from "vitest";

import { assetUrl } from "./assetBase";

describe("assetUrl", () => {
  it("resolves against the root base", () => {
    expect(assetUrl("dore/cuts.json", "/")).toBe("/dore/cuts.json");
  });

  it("prefixes a sub-path base, as GitHub Pages serves the site", () => {
    expect(assetUrl("dore/cuts.json", "/grace-city-collective/")).toBe(
      "/grace-city-collective/dore/cuts.json",
    );
  });

  it("never doubles a slash, whatever the base and path bring", () => {
    expect(assetUrl("/dore", "/grace-city-collective")).toBe("/grace-city-collective/dore");
    expect(assetUrl("/dore/", "/grace-city-collective/")).toBe("/grace-city-collective/dore");
  });

  it("defaults the base to Vite's BASE_URL", () => {
    expect(assetUrl("dore")).toBe(`${import.meta.env.BASE_URL}dore`);
  });
});
