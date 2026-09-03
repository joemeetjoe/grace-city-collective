import type { RootState } from "@react-three/fiber";
import * as THREE from "three";

import type { Tier } from "@/device/tier";
import type { CanvasSide } from "@/theme/layerSplit";
import type { EmberLayer } from "../embers";
import type { Layer } from "../layers";
import type { RayLayer } from "../rayPlanes";
import { registrationDistance } from "../cameraSolve";
import { createTextureWarmer, type TextureWarmer } from "../textureWarm";
import type { FramePlan, SceneOptions, TickState } from "../tick";
import { CAMERA, SCENE_DEFAULTS } from "../tuning";

/**
 * What the two fiber roots and the external loop share (#134 spike): one
 * scene graph, one camera, the tick state, the frame plan in flight and the
 * built objects. Fiber owns a renderer and a canvas per root; everything
 * here is the vanilla engine's own state, held outside React so neither
 * root re-renders for a frame.
 */

/** the built scene: what createParallaxScene keeps in closures */
export type SceneObjects = {
  backdrop: Layer;
  layers: Layer[];
  byName: Map<string, Layer>;
  dove?: Layer;
  rays: RayLayer;
  embers: EmberLayer;
  /** the group the back root mounts as a <primitive>; every plane, ray and the embers hang under it */
  group: THREE.Group;
  /** the planes at the live registration distance */
  resize(baseZ: number): void;
  dispose(): void;
};

export type Shared = {
  tier: Tier;
  reducedMotion: boolean;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  /** the drawing buffer's size, for the front layers' vignette */
  resolution: THREE.Vector2;
  opts: SceneOptions;
  /** the tick's state; built by the component that knows the mount's dpr */
  state: TickState;
  /** the frame the loop decided to draw, for the roots' useFrame */
  plan: FramePlan | null;
  baseZ: number;
  /** the stop whose front row the cuts currently wear; -1 until the first frame */
  frontStop: number;
  objects: SceneObjects | null;
  sections: readonly HTMLElement[];
  roots: Partial<Record<CanvasSide, RootState>>;
  /** a texture uploads on the renderer(s) whose materials sample it (#104), per side */
  warmers: Record<CanvasSide, TextureWarmer<THREE.Texture>>;
  warmOn(texture: THREE.Texture, side: CanvasSide): void;
  /** every texture landed and the warm queues drained: the ready signal, once */
  loaded: boolean;
};

export function createShared(init: { tier: Tier; reducedMotion: boolean; state: TickState; opts: Partial<SceneOptions> }): Shared {
  const shared: Shared = {
    tier: init.tier,
    reducedMotion: init.reducedMotion,
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far),
    resolution: new THREE.Vector2(1, 1),
    opts: { ...SCENE_DEFAULTS, ...init.opts },
    state: init.state,
    plan: null,
    baseZ: 20,
    frontStop: -1,
    objects: null,
    sections: [],
    roots: {},
    warmers: {
      back: createTextureWarmer({ initTexture: (t) => shared.roots.back?.gl.initTexture(t), perFrame: init.tier.warmPerFrame }),
      front: createTextureWarmer({ initTexture: (t) => shared.roots.front?.gl.initTexture(t), perFrame: init.tier.warmPerFrame }),
    },
    warmOn: (t, side) => shared.warmers[side].add(t),
    loaded: false,
  };
  return shared;
}

// The writes React's lint keeps out of components (react-hooks/immutability):
// the shared record is deliberately mutable engine state, never React state.

/** the built graph is up: the loop may arm and the warmers may drain */
export function attachObjects(shared: Shared, objects: SceneObjects): void {
  shared.objects = objects;
  shared.loaded = true;
}

export function detachObjects(shared: Shared, objects: SceneObjects): void {
  if (shared.objects === objects) shared.objects = null;
  objects.dispose();
}

/**
 * the back root's size or ratio changed (fiber has set the camera's aspect
 * and the buffer): the registration distance and the planes follow, the
 * front root takes the same size, and the front vignette reads the buffer
 */
export function syncResize(shared: Shared, objects: SceneObjects, gl: { getDrawingBufferSize(target: THREE.Vector2): THREE.Vector2 }, size: { width: number; height: number }): void {
  const front = shared.roots.front;
  if (front && (front.size.width !== size.width || front.size.height !== size.height)) front.setSize(size.width, size.height);
  gl.getDrawingBufferSize(shared.resolution);
  const baseZ = registrationDistance(shared.camera.aspect);
  if (baseZ === shared.baseZ) return;
  shared.baseZ = baseZ;
  objects.resize(baseZ);
  shared.state.dirty = true;
}

export function registerRoot(shared: Shared, side: CanvasSide, root: RootState): void {
  shared.roots[side] = root;
}

export function setSceneOptions(shared: Shared, next: Partial<SceneOptions>): void {
  Object.assign(shared.opts, next);
  shared.state.dirty = true;
}
