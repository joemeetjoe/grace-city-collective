import { describe, expect, it } from "vitest";

import { channelVector, maskRef } from "./textureManifest";

describe("maskRef", () => {
  it("points a packed entry at its shared texture and channel", () => {
    expect(maskRef({ name: "fig5", mask: { file: "masks-cut-0.webp", channel: 1 } }, "/dore/2048")).toEqual({
      url: "/dore/2048/masks-cut-0.webp",
      channel: 1,
    });
  });

  it("falls back to the cut's own greyscale png for a legacy entry", () => {
    expect(maskRef({ name: "arch" }, "/dore/2048")).toEqual({ url: "/dore/2048/cut-arch.png", channel: 0 });
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
