import * as THREE from "three";

import { supportsAvif } from "@/device/avif";
import { browserInput, type SceneInput } from "./input";
import { GL_FLAGS } from "./tuning";

/**
 * What the scene reads from the page and the platform (#120), behind one
 * injectable object: the factory's public surface names no window, document
 * or WebGL. `browserEnv` is the page's; a test hands in fakes (a renderer
 * that counts contexts, a clock, a scroll).
 */

/** the slice of a WebGLRenderer the scene drives */
export type Renderer = Pick<
  THREE.WebGLRenderer,
  "setPixelRatio" | "setClearColor" | "setSize" | "getDrawingBufferSize" | "dispose" | "initTexture" | "render"
> & { capabilities: { getMaxAnisotropy(): number } };

type RendererParams = typeof GL_FLAGS & { alpha?: boolean };

type Viewport = { width: number; height: number; dpr: number };

export type SceneEnv = {
  /** one renderer per canvas; the WebGL context it takes is the canvas's own */
  createRenderer(canvas: HTMLCanvasElement, params: RendererParams): Renderer;
  viewport(): Viewport;
  /** the document's own scroll; the page hands the smoothed one through the config (createParallaxScene.ts) */
  scrollTop(): number;
  /** the AVIF verdict every texture request waits on (#101) */
  supportsAvif(): Promise<boolean>;
  /** performance.now() */
  now(): number;
  raf(cb: FrameRequestCallback): number;
  caf(id: number): void;
  input: SceneInput;
};

export function browserEnv(win: Window = window, doc: Document = document): SceneEnv {
  return {
    createRenderer: (canvas, params) => new THREE.WebGLRenderer({ canvas, ...params }),
    viewport: () => ({ width: win.innerWidth, height: win.innerHeight, dpr: win.devicePixelRatio || 1 }),
    scrollTop: () => doc.documentElement.scrollTop,
    supportsAvif,
    now: () => performance.now(),
    raf: (cb) => win.requestAnimationFrame(cb),
    caf: (id) => win.cancelAnimationFrame(id),
    input: browserInput(win, doc),
  };
}
