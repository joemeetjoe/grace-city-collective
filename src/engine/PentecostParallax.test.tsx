/**
 * The scene mounted against a fake renderer (#104): jsdom has no WebGL, so
 * three's WebGLRenderer and its two loaders are replaced through a partial
 * mock of "three". The fake renderer records which textures were initialised
 * through `initTexture` and, on `render`, counts every texture the drawn
 * materials sample that it would have had to upload on the spot. It also
 * keeps the live renderers per canvas (#120): a canvas has one WebGL
 * context, so two live renderers on it would share and corrupt it.
 */
import { act, render } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import { TIERS } from "@/device/tier";
import { REST_STATE, useAppStore } from "@/state/appStore";
import { SCENE_ERROR_PREFIX } from "./sceneError";

type FakeRenderer = {
  canvas: HTMLCanvasElement;
  disposed: boolean;
  initialised: Set<THREE.Texture>;
  /** initTexture calls per faked frame (Date.now() under fake timers) */
  initsByFrame: Map<number, number>;
  /** per render call: textures it uploaded because nothing had warmed them */
  renders: { uploads: number; textures: number }[];
  scene: THREE.Scene | null;
};

const fakes = vi.hoisted(() => ({
  renderers: [] as FakeRenderer[],
  /** a renderer constructed on a canvas that already had a live one: never */
  contextClashes: 0,
  /** the loaders' delivery order: each texture lands one step later */
  deliveries: 0,
  /** ms between two textures landing */
  stepMs: 5,
  /** the error path (#131): a context the platform refuses, a texture that fails, the tier's cuts.json missing */
  refuseWebgl: false,
  failUrl: null as RegExp | null,
  manifest: true,
}));

vi.mock("three", async (orig) => {
  const three = await orig<typeof import("three")>();
  class WebGLRenderer implements FakeRenderer {
    canvas: HTMLCanvasElement;
    disposed = false;
    initialised = new Set<THREE.Texture>();
    initsByFrame = new Map<number, number>();
    renders: { uploads: number; textures: number }[] = [];
    scene: THREE.Scene | null = null;
    capabilities = { getMaxAnisotropy: () => 16 };
    constructor({ canvas }: { canvas: HTMLCanvasElement }) {
      if (fakes.refuseWebgl) throw new Error("Error creating WebGL context.");
      this.canvas = canvas;
      if (fakes.renderers.some((r) => r.canvas === canvas && !r.disposed)) fakes.contextClashes += 1;
      fakes.renderers.push(this);
    }
    setPixelRatio() {}
    setClearColor() {}
    setSize() {}
    getDrawingBufferSize(v: THREE.Vector2) {
      return v.set(1024, 768);
    }
    dispose() {
      this.disposed = true;
    }
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
      // a failed request, as three's loaders report one: the manager hears the error, then the item ends
      if (fakes.failUrl?.test(url)) manager.itemError(url);
      else land();
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

vi.mock("@/device/textureManifest", async (orig) => {
  const mod = await orig<typeof import("@/device/textureManifest")>();
  return {
    ...mod,
    tierCuts: (width: Parameters<typeof mod.tierCuts>[0]) => {
      if (!fakes.manifest) throw new Error(`no ${width}/cuts.json in the manifest`);
      return mod.tierCuts(width);
    },
  };
});

import PentecostParallax from "./PentecostParallax";

/** the canvas's IntersectionObserver, driven by the test: off screen until `show()` */
const visibility = { show: () => {} };

beforeEach(() => {
  fakes.renderers.length = 0;
  fakes.contextClashes = 0;
  fakes.deliveries = 0;
  fakes.refuseWebgl = false;
  fakes.failUrl = null;
  fakes.manifest = true;
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
  useAppStore.setState(REST_STATE);
});

const frame = () => act(() => vi.advanceTimersByTimeAsync(16));

/** the loading the scene writes to the store: every progress report, and whether it is ready */
function loading() {
  const progress: number[] = [];
  useAppStore.subscribe((s, prev) => {
    if (s.progress !== prev.progress) progress.push(s.progress);
  });
  return { progress, ready: () => useAppStore.getState().ready };
}

/** the scene paces itself against the page's scene sections, read when it builds (HomePage, over scroll/sections.ts) */
function sections() {
  const els = ["Hero", "About", "Gatherings", "Give", "Visit"].map(() => document.createElement("section"));
  return () => els;
}

async function mountAndLoad(front: boolean) {
  const load = loading();
  const frontCanvas = front ? { current: document.createElement("canvas") } : undefined;
  render(<PentecostParallax tier={TIERS.mobile} frontCanvas={frontCanvas} sections={sections()} />);
  // the AVIF verdict resolves, the loads go out
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(fakes.deliveries).toBeGreaterThan(20);
  for (let i = 0; i < 400 && !load.ready(); i++) await frame();
  expect(load.ready()).toBe(true);
  return load;
}

describe("PentecostParallax texture warm-up (#104)", () => {
  it("reports ready to the store only once every texture has landed and been initialised", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { progress } = await mountAndLoad(false);
    const [renderer] = fakes.renderers;
    // one report per texture, the last at the whole
    expect(progress.length).toBe(fakes.deliveries);
    expect(progress.at(-1)).toBe(1);
    // and nothing went wrong on the way
    expect(useAppStore.getState().sceneError).toBeNull();
    expect(errors).not.toHaveBeenCalled();
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

describe("PentecostParallax as a wrapper (#120)", () => {
  it("under StrictMode's mount → unmount → mount, each canvas has one live renderer (one context), never two", async () => {
    const frontCanvas = { current: document.createElement("canvas") };
    const { unmount } = render(
      <StrictMode>
        <PentecostParallax tier={TIERS.mobile} frontCanvas={frontCanvas} sections={sections()} />
      </StrictMode>,
    );
    await act(() => vi.advanceTimersByTimeAsync(0));
    // two mounts, the first disposed whole before the second built
    expect(fakes.renderers).toHaveLength(4);
    expect(fakes.contextClashes).toBe(0);
    const live = fakes.renderers.filter((r) => !r.disposed);
    expect(new Set(live.map((r) => r.canvas)).size).toBe(2);
    expect(live).toHaveLength(2);
    // the torn-down mount never reports: the store's ready comes from the live one
    for (let i = 0; i < 400 && !useAppStore.getState().ready; i++) await frame();
    expect(useAppStore.getState().ready).toBe(true);
    unmount();
    expect(fakes.renderers.every((r) => r.disposed)).toBe(true);
  });

  it("stays a wrapper: the only three.js call in its source is mounting the handle", async () => {
    const source = await import("./PentecostParallax.tsx?raw");
    expect(source.default).not.toMatch(/from "three"/);
    expect(source.default).not.toMatch(/querySelector|document\.hidden|window\./);
    expect(source.default.trimEnd().split("\n").length).toBeLessThan(90);
  });
});

describe("PentecostParallax error path (#131)", () => {
  /** the store after a failure: the reason, and ready so the splash opens onto the poster */
  const failure = () => {
    const { sceneError, ready } = useAppStore.getState();
    return { sceneError, ready };
  };
  /** console.error calls under the scene's prefix */
  const logged = (errors: ReturnType<typeof vi.spyOn>) => errors.mock.calls.filter(([first]: unknown[]) => first === SCENE_ERROR_PREFIX);

  it("a manifest that throws fails the scene once, ready and logged, before any texture is asked for", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    fakes.manifest = false;
    render(<PentecostParallax tier={TIERS.mobile} sections={sections()} />);
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(failure()).toEqual({ sceneError: "no 1024/cuts.json in the manifest", ready: true });
    expect(logged(errors)).toHaveLength(1);
    expect(errors).toHaveBeenCalledTimes(1);
    // the backdrop and the depth map went out; no cut did
    expect(fakes.deliveries).toBe(2);
  });

  it("a texture that fails to load fails the scene with its url, once however many fail after it", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    fakes.failUrl = /map-/;
    render(<PentecostParallax tier={TIERS.mobile} sections={sections()} />);
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(failure()).toEqual({ sceneError: null, ready: false });
    for (let i = 0; i < 400 && !useAppStore.getState().ready; i++) await frame();
    const { sceneError, ready } = failure();
    expect(ready).toBe(true);
    expect(sceneError).toMatch(/^texture failed: .*map-.*\.webp$/);
    // every map fails; the manager drains all the same
    await act(() => vi.advanceTimersByTimeAsync(fakes.deliveries * fakes.stepMs));
    expect(useAppStore.getState().sceneError).toBe(sceneError);
    expect(logged(errors)).toHaveLength(1);
    expect(errors).toHaveBeenCalledTimes(1);
  });

  it("a front canvas the page meant to hand over but had not mounted fails the scene before any context is taken", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<PentecostParallax tier={TIERS.mobile} frontCanvas={{ current: null }} sections={sections()} />);
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(failure()).toEqual({ sceneError: "front canvas missing", ready: true });
    expect(fakes.renderers).toHaveLength(0);
    expect(fakes.deliveries).toBe(0);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(logged(errors)).toHaveLength(1);
  });

  it("a refused WebGL context at mount fails the scene, logged once, and the wrapper still unmounts clean", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    fakes.refuseWebgl = true;
    const { unmount } = render(<PentecostParallax tier={TIERS.mobile} sections={sections()} />);
    expect(failure()).toEqual({ sceneError: "Error creating WebGL context.", ready: true });
    await act(() => vi.advanceTimersByTimeAsync(0));
    expect(fakes.deliveries).toBe(0);
    expect(logged(errors)).toHaveLength(1);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(() => unmount()).not.toThrow();
  });
});
