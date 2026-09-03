/**
 * The scene mounted against a fake renderer (#104): jsdom has no WebGL, so
 * three's WebGLRenderer and its two loaders are replaced through a partial
 * mock of "three". The fake renderer records which textures were initialised
 * through `initTexture` and, on `render`, counts every texture the drawn
 * materials sample that it would have had to upload on the spot.
 */
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { TIERS } from "@/device/tier";

type FakeRenderer = {
  initialised: Set<THREE.Texture>;
  /** initTexture calls per faked frame (Date.now() under fake timers) */
  initsByFrame: Map<number, number>;
  /** per render call: textures it uploaded because nothing had warmed them */
  renders: { uploads: number; textures: number }[];
  scene: THREE.Scene | null;
};

const fakes = vi.hoisted(() => ({
  renderers: [] as FakeRenderer[],
  /** the loaders' delivery order: each texture lands one step later */
  deliveries: 0,
  /** ms between two textures landing */
  stepMs: 5,
}));

vi.mock("three", async (orig) => {
  const three = await orig<typeof import("three")>();
  class WebGLRenderer implements FakeRenderer {
    initialised = new Set<THREE.Texture>();
    initsByFrame = new Map<number, number>();
    renders: { uploads: number; textures: number }[] = [];
    scene: THREE.Scene | null = null;
    capabilities = { getMaxAnisotropy: () => 16 };
    constructor() {
      fakes.renderers.push(this);
    }
    setPixelRatio() {}
    setClearColor() {}
    setSize() {}
    getDrawingBufferSize(v: THREE.Vector2) {
      return v.set(1024, 768);
    }
    dispose() {}
    initTexture(t: THREE.Texture) {
      const frame = Date.now();
      this.initsByFrame.set(frame, (this.initsByFrame.get(frame) ?? 0) + 1);
      this.initialised.add(t);
    }
    render(scene: THREE.Scene, camera: THREE.Camera) {
      this.scene = scene;
      const seen = new Set<THREE.Texture>();
      let uploads = 0;
      scene.traverse((obj) => {
        if (!obj.layers.test(camera.layers)) return;
        const mat = (obj as THREE.Mesh).material as THREE.ShaderMaterial | undefined;
        if (!mat?.uniforms) return;
        for (const u of Object.values(mat.uniforms)) {
          const v = u.value as { isTexture?: boolean } | null;
          if (!v?.isTexture) continue;
          const t = v as THREE.Texture;
          // a texture without an image binds nothing; one with a new version uploads
          if (t.version === 0 || seen.has(t)) continue;
          seen.add(t);
          if (!this.initialised.has(t)) {
            uploads += 1;
            this.initialised.add(t);
          }
        }
      });
      this.renders.push({ uploads, textures: seen.size });
    }
  }
  const deliver = (manager: THREE.LoadingManager, url: string, land: () => void) => {
    manager.itemStart(url);
    fakes.deliveries += 1;
    setTimeout(() => {
      land();
      manager.itemEnd(url);
    }, fakes.deliveries * fakes.stepMs);
  };
  class TextureLoader extends three.Loader<THREE.Texture> {
    load(url: string, onLoad?: (t: THREE.Texture) => void) {
      const t = new three.Texture();
      deliver(this.manager, url, () => {
        t.image = { width: 4, height: 4 };
        t.needsUpdate = true;
        onLoad?.(t);
      });
      return t;
    }
  }
  class ImageBitmapLoader extends three.Loader<ImageBitmap> {
    setOptions() {
      return this;
    }
    load(url: string, onLoad?: (b: ImageBitmap) => void) {
      deliver(this.manager, url, () => onLoad?.({ width: 4, height: 4, close() {} } as ImageBitmap));
    }
  }
  return { ...three, WebGLRenderer, TextureLoader, ImageBitmapLoader };
});

vi.mock("@/device/avif", () => ({ supportsAvif: () => Promise.resolve(false) }));

import PentecostParallax from "./PentecostParallax";

/** the canvas's IntersectionObserver, driven by the test: off screen until `show()` */
const visibility = { show: () => {} };

beforeEach(() => {
  fakes.renderers.length = 0;
  fakes.deliveries = 0;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date", "requestAnimationFrame", "cancelAnimationFrame"] });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        visibility.show = () => cb([{ isIntersecting: true }]);
      }
      observe() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const frame = () => act(() => vi.advanceTimersByTimeAsync(16));

async function mountAndLoad(front: boolean) {
  const onReady = vi.fn();
  const onProgress = vi.fn();
  const frontCanvas = front ? { current: document.createElement("canvas") } : undefined;
  // the scene paces itself against the page's labelled sections (sectionRects.ts)
  for (const label of ["Hero", "About", "Gatherings", "Give", "Visit"]) {
    const section = document.createElement("section");
    section.dataset.screenLabel = label;
    document.body.append(section);
  }
  render(<PentecostParallax tier={TIERS.mobile} frontCanvas={frontCanvas} onReady={onReady} onProgress={onProgress} />);
  // the AVIF verdict resolves, the loads go out
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(fakes.deliveries).toBeGreaterThan(20);
  for (let i = 0; i < 400 && !onReady.mock.calls.length; i++) await frame();
  expect(onReady).toHaveBeenCalledTimes(1);
  return { onReady, onProgress };
}

describe("PentecostParallax texture warm-up (#104)", () => {
  it("reports ready only once every texture has landed and been initialised", async () => {
    const { onProgress } = await mountAndLoad(false);
    const [renderer] = fakes.renderers;
    const [loaded, total] = onProgress.mock.calls.at(-1)!;
    expect(loaded).toBe(total);
    expect(total).toBe(fakes.deliveries);
    // nothing rendered yet (the canvas was off screen); the warmer did every upload
    expect(renderer.renders).toHaveLength(0);
    expect(renderer.initialised.size).toBeGreaterThan(20);
  });

  it("the first render after the handoff uploads no texture", async () => {
    await mountAndLoad(false);
    const [renderer] = fakes.renderers;
    act(() => visibility.show());
    await frame();
    expect(renderer.renders.length).toBeGreaterThanOrEqual(1);
    const first = renderer.renders[0];
    expect(first.textures).toBeGreaterThan(20);
    expect(first.uploads).toBe(0);
  });

  it("with a front canvas both renderers draw their first frame without an upload", async () => {
    await mountAndLoad(true);
    const [back, front] = fakes.renderers;
    expect(fakes.renderers).toHaveLength(2);
    act(() => visibility.show());
    await frame();
    expect(back.renders[0].textures).toBeGreaterThan(10);
    expect(back.renders[0].uploads).toBe(0);
    expect(front.renders[0].textures).toBeGreaterThan(0);
    expect(front.renders[0].uploads).toBe(0);
  });

  it("spreads the warm-up: no frame initialises more than the tier's warmPerFrame", async () => {
    await mountAndLoad(false);
    const [renderer] = fakes.renderers;
    const perFrame = [...renderer.initsByFrame.values()];
    expect(Math.max(...perFrame)).toBeLessThanOrEqual(TIERS.mobile.warmPerFrame);
    expect(perFrame.length).toBeGreaterThan(1);
  });
});
