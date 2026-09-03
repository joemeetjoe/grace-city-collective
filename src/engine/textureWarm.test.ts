import { describe, expect, it, vi } from "vitest";

import { createTextureWarmer } from "./textureWarm";

type Tex = { id: number };
const textures = (n: number): Tex[] => Array.from({ length: n }, (_, id) => ({ id }));

function warmer(perFrame: number) {
  const initTexture = vi.fn<(t: Tex) => void>();
  return { initTexture, warm: createTextureWarmer<Tex>({ initTexture, perFrame }) };
}

describe("createTextureWarmer", () => {
  it("initialises nothing until a tick, then at most perFrame per tick", () => {
    const { initTexture, warm } = warmer(3);
    for (const t of textures(7)) warm.add(t);
    expect(initTexture).not.toHaveBeenCalled();
    expect(warm.pending()).toBe(7);
    expect(warm.tick()).toBe(3);
    expect(initTexture).toHaveBeenCalledTimes(3);
    expect(warm.pending()).toBe(4);
    expect(warm.tick()).toBe(3);
    expect(warm.tick()).toBe(1);
    expect(warm.tick()).toBe(0);
    expect(initTexture).toHaveBeenCalledTimes(7);
    expect(warm.pending()).toBe(0);
  });

  it("initialises every texture exactly once, in arrival order", () => {
    const { initTexture, warm } = warmer(2);
    const all = textures(5);
    for (const t of all) warm.add(t);
    while (warm.pending()) warm.tick();
    expect(initTexture.mock.calls.map(([t]) => t)).toEqual(all);
  });

  it("a texture added twice is initialised once", () => {
    const { initTexture, warm } = warmer(4);
    const [a, b] = textures(2);
    warm.add(a);
    warm.add(b);
    warm.add(a);
    expect(warm.pending()).toBe(2);
    warm.tick();
    warm.add(a);
    expect(warm.pending()).toBe(0);
    expect(warm.tick()).toBe(0);
    expect(initTexture).toHaveBeenCalledTimes(2);
  });

  it("textures arriving between ticks join the queue behind the earlier ones", () => {
    const { initTexture, warm } = warmer(2);
    const [a, b, c] = textures(3);
    warm.add(a);
    warm.tick();
    warm.add(b);
    warm.add(c);
    expect(warm.tick()).toBe(2);
    expect(initTexture.mock.calls.map(([t]) => t)).toEqual([a, b, c]);
  });

  it("a perFrame under one still makes progress: one texture per tick", () => {
    const { warm } = warmer(0);
    for (const t of textures(2)) warm.add(t);
    expect(warm.tick()).toBe(1);
    expect(warm.pending()).toBe(1);
  });
});
