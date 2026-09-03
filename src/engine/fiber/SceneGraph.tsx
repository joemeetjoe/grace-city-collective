import { useFrame, useThree } from "@react-three/fiber";
import { use, useEffect, useLayoutEffect, useMemo, useState } from "react";
import * as THREE from "three";

import { supportsAvif } from "@/device/avif";
import { tierWidth } from "@/device/tier";
import { maskRef, textureUrl, tierCuts } from "@/device/textureManifest";
import { EMBERS_SIDE, assignLayer, canvasFor, layerMask } from "@/theme/layerSplit";
import { registrationDistance } from "../cameraSolve";
import { createEmbers, emberCount } from "../embers";
import { buildLayers, layerGeometry, planeGeometry } from "../layers";
import { parseCuts, type Cut } from "../parallaxRelief";
import { RAY_NEAR_Z, createRayLayer, rayRenderOrder, raySpecs } from "../rayPlanes";
import type { TextureSet } from "../textures";
import { placeLayer, type FramePlan } from "../tick";
import { DOVE_V, FIT, PLATE } from "../tuning";
import { useSceneTexturesFiber, type TextureUrls } from "./sceneTextures";
import { useSceneTexturesDrei } from "./sceneTexturesDrei";
import { attachObjects, detachObjects, syncResize, type SceneObjects, type Shared } from "./shared";

/**
 * The scene graph under the back root (#134 spike). Suspends on the AVIF
 * verdict and then on every texture (sceneTextures.ts); once they resolve
 * the planes, the rays and the embers are built by the vanilla factories
 * into one group, mounted as a <primitive>. The per-frame writes are the
 * vanilla tick's, applied in useFrame from the plan the loop decided, and
 * the back pass is drawn right there at priority 1 — so fiber's own render
 * never runs and the pacer's veto holds.
 */

const useSceneTextures = __R3F_DREI__ ? useSceneTexturesDrei : useSceneTexturesFiber;

// `use` needs the same promise on every render
let avifPromise: Promise<boolean> | undefined;
const avifVerdict = () => (avifPromise ??= supportsAvif());

export type SceneGraphProps = {
  shared: Shared;
  rays?: number;
  embers?: number;
  /** the graph is built and its textures are queued on the warmers */
  onBuilt: () => void;
};

export default function SceneGraph({ shared, rays, embers, onBuilt }: SceneGraphProps) {
  const avif = use(avifVerdict());
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const width = tierWidth(shared.tier);
  const { cuts, url, urls } = useMemo(() => {
    const url = (file: string) => textureUrl(width, file, { avif });
    const cuts = parseCuts(tierCuts(width));
    return { cuts, url, urls: textureUrlsOf(cuts, url) };
  }, [width, avif]);
  const textures = useSceneTextures(urls, gl.capabilities.getMaxAnisotropy());
  // built once from the resolved textures, disposed with the mount
  const [objects] = useState(() => build(shared, cuts, url, textures, { rays, embers }));
  useEffect(() => {
    attachObjects(shared, objects);
    onBuilt();
    return () => detachObjects(shared, objects);
  }, [shared, objects, onBuilt]);

  // fiber has already set the camera's aspect for this size (shared.ts syncResize)
  useLayoutEffect(() => {
    syncResize(shared, objects, gl, size);
  }, [size, dpr, gl, objects, shared]);

  useFrame(({ gl, camera }) => {
    const plan = shared.plan;
    if (!plan) return;
    applyPlan(shared, objects, plan, gl.domElement.height);
    camera.layers.set(layerMask("back"));
    gl.render(shared.scene, camera);
  }, 1);

  return <primitive object={objects.group} />;
}

/** every url the cuts need, once each, in the order the loaders take them */
function textureUrlsOf(cuts: Cut[], url: (file: string) => string): TextureUrls {
  const colour = new Set<string>([url("plate-backdrop.webp")]);
  const depth = new Set<string>([url("depth.webp")]);
  const masks = new Set<string>();
  for (const cut of cuts) {
    colour.add(url(cut.map));
    if (cut.depthMap) depth.add(url(cut.depthMap));
    masks.add(maskRef(cut, url).url);
  }
  return { colour: [...colour], depth: [...depth], masks: [...masks] };
}

/** the vanilla factories over one group: what createParallaxScene's start() does */
function build(
  shared: Shared,
  cuts: Cut[],
  url: (file: string) => string,
  textures: TextureSet,
  cfg: { rays?: number; embers?: number },
): SceneObjects {
  const { tier, camera, resolution, opts } = shared;
  const group = new THREE.Group();
  group.name = "parallax";
  shared.baseZ = registrationDistance(camera.aspect);
  const built = buildLayers(cuts, {
    scene: group,
    textures,
    url,
    backdrop: textures.load(url("plate-backdrop.webp"), "colour"),
    depthMap: textures.load(url("depth.webp"), "depth"),
    tier: tier.name,
    sideOf: (side) => side,
    baseZ: shared.baseZ,
    resolution,
    beamGlow: opts.beamGlow,
    flameDrift: opts.flameDrift,
    warmOn: shared.warmOn,
  });
  const { backdrop, layers } = built;
  const layerZ = layers.map((l) => l.z);
  const rays = createRayLayer(raySpecs(cfg.rays ?? tier.rays), {
    geom: (z) => planeGeometry(z, shared.baseZ),
    fit: FIT,
    plate: PLATE,
    origin: [0.5, 1 - DOVE_V],
    renderOrder: () => rayRenderOrder(layerZ, RAY_NEAR_Z),
  });
  for (const m of rays.meshes) group.add(assignLayer(m, "back"));
  const vp = { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1 };
  const count = cfg.embers ?? emberCount({ ...vp, reducedMotion: shared.reducedMotion, tier: tier.name });
  const embers = createEmbers({ scene: group, camera, count, renderOrder: layers.length + 1, resolution });
  assignLayer(embers.points, EMBERS_SIDE);
  const all = [backdrop, ...layers];
  return {
    backdrop,
    layers,
    byName: new Map(layers.map((l) => [l.name, l])),
    dove: layers.find((l) => l.name === "dove"),
    rays,
    embers,
    group,
    resize(baseZ) {
      for (const l of all) {
        l.mesh.geometry.dispose();
        l.mesh.geometry = layerGeometry(l, baseZ);
      }
      rays.resize();
    },
    dispose() {
      for (const l of all) {
        l.mesh.geometry.dispose();
        l.mat.dispose();
      }
      rays.dispose();
      embers.dispose();
      textures.dispose();
    },
  };
}

/** the vanilla tick's writes to the scene, from a plan (createParallaxScene.ts) */
function applyPlan(shared: Shared, o: SceneObjects, plan: FramePlan, heightPx: number): void {
  const { camera, tier, opts } = shared;
  if (plan.stop !== shared.frontStop) {
    shared.frontStop = plan.stop;
    for (const l of o.layers) {
      const side = canvasFor(l, plan.stop, tier.name);
      if (side === l.side) continue;
      l.side = side;
      assignLayer(l.mesh, side);
      l.mat.uniforms.uVignette.value = side === "front" ? 1 : 0;
    }
  }
  const { position, target } = plan.pose;
  camera.position.set(position.x, position.y, position.z);
  camera.lookAt(target.x, target.y, target.z);
  o.rays.update({ intensity: plan.beam, glow: opts.beamGlow, zScale: plan.zScale, baseZ: shared.baseZ, cam: camera.position });
  const frame = { baseZ: shared.baseZ, zScale: plan.zScale, relief: plan.relief, flock: plan.flock, doveZ: o.dove?.z };
  for (const l of [o.backdrop, ...o.layers]) {
    const u = l.mat.uniforms;
    u.uBeam.value = plan.beam;
    u.uBeamMax.value = opts.beamGlow;
    u.uFlameDrift.value = opts.flameDrift ? 1 : 0;
    const parentAt = l.parent !== undefined ? o.byName.get(l.parent)?.at : undefined;
    const p = placeLayer({ z: l.z, relief: l.relief, at: l.at, flame: l.flame, parentAt }, frame);
    l.mesh.position.set(p.position.x, p.position.y, p.position.z);
    l.mesh.scale.setScalar(p.scale);
    u.uRelief.value = p.uRelief;
    u.uCamZ.value = p.uCamZ;
    u.uLayerZ.value = p.uLayerZ;
    u.uScale.value = p.uScale;
  }
  o.embers.update({ t: plan.emberT, progress: plan.progress, sectionCount: shared.sections.length, heightPx, refZ: shared.baseZ });
}
