import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AVIF_PROBE_SRC, AVIF_VERDICT_KEY, avifProbeScript, supportsAvif, type AvifVerdict } from "./avif";

type Host = { [AVIF_VERDICT_KEY]?: AvifVerdict };
const host = globalThis as unknown as Host;

/** an Image that decodes (or refuses) on the next microtask, like the browser's */
function fakeImage(decodes: boolean) {
  const made: Array<{ src: string }> = [];
  class FakeImage {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    width = 0;
    #src = "";
    constructor() {
      made.push(this);
    }
    get src() {
      return this.#src;
    }
    set src(v: string) {
      this.#src = v;
      queueMicrotask(() => {
        if (decodes) {
          this.width = 1;
          this.onload?.();
        } else this.onerror?.();
      });
    }
  }
  vi.stubGlobal("Image", FakeImage);
  return made;
}

beforeEach(() => {
  delete host[AVIF_VERDICT_KEY];
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete host[AVIF_VERDICT_KEY];
});

describe("AVIF_PROBE_SRC", () => {
  it("is a small inline avif", () => {
    expect(AVIF_PROBE_SRC.startsWith("data:image/avif;base64,")).toBe(true);
    expect(AVIF_PROBE_SRC.length).toBeLessThan(600);
    expect(() => atob(AVIF_PROBE_SRC.split(",")[1])).not.toThrow();
  });
});

describe("avifProbeScript", () => {
  const run = () => new Function(avifProbeScript())();

  it("stores the verdict as a promise on the window: true where the probe decodes", async () => {
    const made = fakeImage(true);
    run();
    const verdict = host[AVIF_VERDICT_KEY];
    expect(verdict).toBeInstanceOf(Promise);
    await expect(verdict).resolves.toBe(true);
    expect(made).toHaveLength(1);
    expect(made[0].src).toBe(AVIF_PROBE_SRC);
  });

  it("resolves false where the probe image fails to decode", async () => {
    fakeImage(false);
    run();
    await expect(host[AVIF_VERDICT_KEY]).resolves.toBe(false);
  });

  it("leaves a verdict already forced on the window alone", async () => {
    const made = fakeImage(true);
    host[AVIF_VERDICT_KEY] = false;
    run();
    expect(host[AVIF_VERDICT_KEY]).toBe(false);
    expect(made).toHaveLength(0);
  });

  it("is self-contained: no imports, nothing but an Image and the window", () => {
    const script = avifProbeScript();
    expect(script).not.toMatch(/\bimport\b|\brequire\b|document\./);
    expect(script).toContain(AVIF_PROBE_SRC);
  });
});

describe("supportsAvif", () => {
  it("reads a verdict the head already settled, without probing again", async () => {
    const made = fakeImage(true);
    host[AVIF_VERDICT_KEY] = false;
    await expect(supportsAvif()).resolves.toBe(false);
    host[AVIF_VERDICT_KEY] = Promise.resolve(true);
    await expect(supportsAvif()).resolves.toBe(true);
    expect(made).toHaveLength(0);
  });

  it("runs the same probe when no verdict is present, and keeps the result for the next caller", async () => {
    const made = fakeImage(true);
    await expect(supportsAvif()).resolves.toBe(true);
    expect(made).toHaveLength(1);
    expect(made[0].src).toBe(AVIF_PROBE_SRC);
    await expect(supportsAvif()).resolves.toBe(true);
    expect(made).toHaveLength(1);
  });

  it("is false where the probe fails, and where there is no Image at all (node)", async () => {
    fakeImage(false);
    await expect(supportsAvif()).resolves.toBe(false);
    delete host[AVIF_VERDICT_KEY];
    vi.stubGlobal("Image", undefined);
    await expect(supportsAvif()).resolves.toBe(false);
  });
});
