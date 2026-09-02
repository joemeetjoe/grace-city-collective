import { describe, expect, it } from "vitest";

import {
  TEXTURE_TABLE,
  channelVector,
  maskRef,
  resolveTexture,
  textureUrl,
  tierCuts,
  type TextureTable,
} from "./textureManifest";

const table: TextureTable = {
  "2048/plate.webp": "/assets/plate-a1b2c3.webp",
  "1024/plate.webp": "/assets/plate-d4e5f6.webp",
  "2048/masks-cut-0.webp": "/assets/masks-cut-0-0a0a0a.webp",
  "2048/cut-arch.png": "/assets/cut-arch-777777.png",
};

describe("resolveTexture", () => {
  it("maps a tier's file name to its hashed url", () => {
    expect(resolveTexture(table, 2048, "plate.webp")).toBe("/assets/plate-a1b2c3.webp");
    expect(resolveTexture(table, 1024, "plate.webp")).toBe("/assets/plate-d4e5f6.webp");
  });

  it("never hands one tier the other's texture", () => {
    expect(resolveTexture(table, 2048, "plate.webp")).not.toBe(resolveTexture(table, 1024, "plate.webp"));
    expect(() => resolveTexture(table, 1024, "masks-cut-0.webp")).toThrow(/1024\/masks-cut-0\.webp/);
  });

  it("refuses a file the tier does not ship", () => {
    expect(() => resolveTexture(table, 2048, "nope.webp")).toThrow(Error);
  });
});

describe("the bundled texture table", () => {
  const files = (width: number) => Object.keys(TEXTURE_TABLE).filter((k) => k.startsWith(`${width}/`));

  it("holds every webp of both tiers, each under its own hashed url", () => {
    expect(files(2048)).toHaveLength(35);
    expect(files(1024)).toHaveLength(35);
    expect(files(2048).map((k) => k.slice(5)).sort()).toEqual(files(1024).map((k) => k.slice(5)).sort());
    expect(textureUrl(2048, "plate.webp")).not.toBe(textureUrl(1024, "plate.webp"));
    expect(new Set(Object.values(TEXTURE_TABLE)).size).toBe(70);
  });

  it("bundles each tier's cuts.json", () => {
    const cuts = tierCuts(2048) as Array<{ name: string; mask: { file: string } }>;
    expect(cuts.length).toBeGreaterThan(20);
    for (const cut of cuts) expect(() => textureUrl(2048, cut.mask.file)).not.toThrow();
    expect(tierCuts(1024)).not.toBe(cuts);
  });
});

describe("maskRef", () => {
  const resolve = (file: string) => resolveTexture(table, 2048, file);

  it("points a packed entry at its shared texture and channel", () => {
    expect(maskRef({ name: "fig5", mask: { file: "masks-cut-0.webp", channel: 1 } }, resolve)).toEqual({
      url: "/assets/masks-cut-0-0a0a0a.webp",
      channel: 1,
    });
  });

  it("falls back to the cut's own greyscale png for a legacy entry", () => {
    expect(maskRef({ name: "arch" }, resolve)).toEqual({ url: "/assets/cut-arch-777777.png", channel: 0 });
  });
});

describe("channelVector", () => {
  it("selects one channel of an rgba sample when dotted with it", () => {
    expect(channelVector(0)).toEqual([1, 0, 0, 0]);
    expect(channelVector(1)).toEqual([0, 1, 0, 0]);
    expect(channelVector(2)).toEqual([0, 0, 1, 0]);
    expect(channelVector(3)).toEqual([0, 0, 0, 1]);
  });

  it("refuses a channel the texture does not have", () => {
    expect(() => channelVector(4)).toThrow(RangeError);
    expect(() => channelVector(-1)).toThrow(RangeError);
    expect(() => channelVector(1.5)).toThrow(RangeError);
  });
});
