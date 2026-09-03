import { describe, expect, it } from "vitest";

import {
  TEXTURE_TABLE,
  channelVector,
  isColourTexture,
  maskRef,
  resolveTexture,
  textureUrl,
  tierCuts,
  type TextureTable,
} from "./textureManifest";

const table: TextureTable = {
  "2048/plate-backdrop.webp": "/assets/plate-backdrop-a1b2c3.webp",
  "1024/plate-backdrop.webp": "/assets/plate-backdrop-d4e5f6.webp",
  "2048/masks-cut-0.webp": "/assets/masks-cut-0-0a0a0a.webp",
  "2048/cut-arch.png": "/assets/cut-arch-777777.png",
  "2048/plate-backdrop.avif": "/assets/plate-backdrop-a1b2c3.avif",
  "1024/plate-backdrop.avif": "/assets/plate-backdrop-d4e5f6.avif",
  "2048/map-floor.webp": "/assets/map-floor-111111.webp",
  "2048/map-floor.avif": "/assets/map-floor-111111.avif",
  "2048/map-dove.webp": "/assets/map-dove-222222.webp",
  "2048/depth.webp": "/assets/depth-333333.webp",
};

describe("resolveTexture", () => {
  it("maps a tier's file name to its hashed url", () => {
    expect(resolveTexture(table, 2048, "plate-backdrop.webp")).toBe("/assets/plate-backdrop-a1b2c3.webp");
    expect(resolveTexture(table, 1024, "plate-backdrop.webp")).toBe("/assets/plate-backdrop-d4e5f6.webp");
  });

  it("never hands one tier the other's texture", () => {
    expect(resolveTexture(table, 2048, "plate-backdrop.webp")).not.toBe(resolveTexture(table, 1024, "plate-backdrop.webp"));
    expect(() => resolveTexture(table, 1024, "masks-cut-0.webp")).toThrow(/1024\/masks-cut-0\.webp/);
  });

  it("refuses a file the tier does not ship", () => {
    expect(() => resolveTexture(table, 2048, "nope.webp")).toThrow(Error);
  });

  it("hands out the avif twin of a colour texture where the verdict is avif", () => {
    expect(resolveTexture(table, 2048, "plate-backdrop.webp", { avif: true })).toBe("/assets/plate-backdrop-a1b2c3.avif");
    expect(resolveTexture(table, 1024, "plate-backdrop.webp", { avif: true })).toBe("/assets/plate-backdrop-d4e5f6.avif");
    expect(resolveTexture(table, 2048, "map-floor.webp", { avif: true })).toBe("/assets/map-floor-111111.avif");
    expect(resolveTexture(table, 2048, "map-floor.webp", { avif: false })).toBe("/assets/map-floor-111111.webp");
    expect(resolveTexture(table, 2048, "map-floor.webp")).toBe("/assets/map-floor-111111.webp");
  });

  it("never swaps a mask or a depth texture, whatever the verdict", () => {
    expect(resolveTexture(table, 2048, "masks-cut-0.webp", { avif: true })).toBe("/assets/masks-cut-0-0a0a0a.webp");
    expect(resolveTexture(table, 2048, "depth.webp", { avif: true })).toBe("/assets/depth-333333.webp");
    expect(resolveTexture(table, 2048, "cut-arch.png", { avif: true })).toBe("/assets/cut-arch-777777.png");
  });

  it("falls back to the webp of a colour texture whose avif twin the tier lacks", () => {
    expect(resolveTexture(table, 2048, "map-dove.webp", { avif: true })).toBe("/assets/map-dove-222222.webp");
  });
});

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

describe("the bundled texture table", () => {
  const files = (width: number) => Object.keys(TEXTURE_TABLE).filter((k) => k.startsWith(`${width}/`));

  it("holds every webp and avif of both tiers, each under its own hashed url", () => {
    // the backdrop, 32 cut maps, 11 figure depths, the shared depth, 9 mask
    // packs — and an avif twin of the backdrop and every map (#101)
    expect(files(2048)).toHaveLength(54 + 33);
    expect(files(1024)).toHaveLength(54 + 33);
    expect(files(2048).map((k) => k.slice(5)).sort()).toEqual(files(1024).map((k) => k.slice(5)).sort());
    expect(textureUrl(2048, "plate-backdrop.webp")).not.toBe(textureUrl(1024, "plate-backdrop.webp"));
    expect(new Set(Object.values(TEXTURE_TABLE)).size).toBe(174);
  });

  it("pairs every colour texture with an avif twin, and nothing else", () => {
    const names = files(2048).map((k) => k.slice(5));
    const avifs = names.filter((n) => n.endsWith(".avif"));
    expect(avifs).toHaveLength(33);
    for (const a of avifs) {
      const webp = a.replace(/\.avif$/, ".webp");
      expect(names).toContain(webp);
      expect(isColourTexture(webp)).toBe(true);
    }
    for (const n of names.filter((n) => isColourTexture(n))) expect(names).toContain(n.replace(/\.webp$/, ".avif"));
    expect(textureUrl(2048, "plate-backdrop.webp", { avif: true })).toMatch(/\.avif$/);
    expect(textureUrl(2048, "masks-cut-0.webp", { avif: true })).toMatch(/\.webp$/);
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
