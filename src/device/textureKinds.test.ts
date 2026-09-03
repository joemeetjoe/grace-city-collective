import { describe, expect, it } from "vitest";

import { HERO_TEXTURES, isColourTexture, preloadAs, textureKind } from "./textureKinds";

describe("isColourTexture", () => {
  it("names the backdrop and the cut maps, not the masks or depths", () => {
    expect(isColourTexture("plate-backdrop.webp")).toBe(true);
    expect(isColourTexture("map-fig5.webp")).toBe(true);
    expect(isColourTexture("map-flame12.webp")).toBe(true);
    expect(isColourTexture("masks-cut-0.webp")).toBe(false);
    expect(isColourTexture("masks-flame-1.webp")).toBe(false);
    expect(isColourTexture("depth.webp")).toBe(false);
    expect(isColourTexture("depth-fig5.webp")).toBe(false);
    expect(isColourTexture("cut-arch.png")).toBe(false);
  });
});

describe("textureKind", () => {
  it("sorts a tier file into colour, mask or depth by its name", () => {
    expect(textureKind("plate-backdrop.webp")).toBe("colour");
    expect(textureKind("map-flame3.webp")).toBe("colour");
    expect(textureKind("masks-cut-0.webp")).toBe("mask");
    expect(textureKind("masks-flame-2.webp")).toBe("mask");
    expect(textureKind("depth.webp")).toBe("depth");
    expect(textureKind("depth-fig12.webp")).toBe("depth");
  });

  it("is an error for a file that is none of them", () => {
    expect(() => textureKind("cuts.json")).toThrow(/not a tier texture/);
    expect(() => textureKind("plate-backdrop.avif")).toThrow(/not a tier texture/);
  });

  it("preloads the packed masks as a fetch and everything else as an image", () => {
    expect(preloadAs("mask")).toBe("fetch");
    expect(preloadAs("colour")).toBe("image");
    expect(preloadAs("depth")).toBe("image");
  });
});

describe("HERO_TEXTURES", () => {
  it("leads with the backdrop and the foreground pack, six files of known kinds", () => {
    expect(HERO_TEXTURES).toHaveLength(6);
    expect(HERO_TEXTURES[0]).toBe("plate-backdrop.webp");
    expect(HERO_TEXTURES[1]).toBe("masks-cut-0.webp");
    expect(HERO_TEXTURES.map(textureKind)).toEqual(["colour", "mask", "colour", "colour", "colour", "colour"]);
  });
});
