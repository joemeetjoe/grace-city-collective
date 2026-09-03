import * as THREE from "three";

import { bakeUv, maskBounds, type MaskBounds } from "@/device/maskBounds";
import { channelVector, maskRef, type TextureResolver } from "@/device/textureManifest";
import type { TierName } from "@/device/tier";
import { assignLayer, canvasFor, type CanvasSide } from "@/theme/layerSplit";
import {
  FULL_RECT,
  bindFlames,
  depthRect,
  rectToUv,
  segmentsFor,
  type Cut,
  type UvRect,
} from "./parallaxRelief";
import { FRAG, VERT } from "./shaders";
import type { TextureSet } from "./textures";
import { BACKDROP_Z, BEAM_REST, FIT, FIT_BG, PLATE } from "./tuning";

/**
 * The cut planes (#120): a plane and a material per cut, and the backdrop
 * behind them. Built once from cuts.json; the tick moves them (tick.ts).
 */

export type Layer = {
  name: string;
  z: number;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  isFlame: number;
  relief: number;
  i: number;
  /** which canvas it draws to at the current stop (layerSplit.ts) */
  side: CanvasSide;
  fit?: number;
  /** the cut's centre as plate fractions (figures and flames), and a flame's ordinal among the flames */
  at?: [number, number];
  flame?: number;
  /** a flame's parent cut, whose huddle shift it rides */
  parent?: string;
  /** the cut's padded mask box (#69); a plane without one spans the plate */
  bounds?: MaskBounds;
};

/**
 * A cut's plane for a rest depth. With bounds the plane covers only its
 * cut's padded mask box (#69), placed in the same plate-centred local frame
 * — so the relief shrink-toward-the-axis algebra, the huddle and the flame
 * poses hold unchanged — with the uv baked so the vertex shader's
 * (uv − 0.5) / uFit + 0.5 lands on the plate position each vertex actually
 * covers.
 */
export function planeGeometry(
  z: number,
  baseZ: number,
  fit = FIT,
  seg: [number, number] = [1, 1],
  b?: MaskBounds,
): THREE.PlaneGeometry {
  const k = (baseZ - z) / baseZ;
  if (!b) return new THREE.PlaneGeometry((PLATE.w / fit) * k, (PLATE.h / fit) * k, seg[0], seg[1]);
  const [u0, v0, u1, v1] = b;
  const g = new THREE.PlaneGeometry((u1 - u0) * PLATE.w * k, (v1 - v0) * PLATE.h * k, seg[0], seg[1]);
  g.translate(((u0 + u1) / 2 - 0.5) * PLATE.w * k, (0.5 - (v0 + v1) / 2) * PLATE.h * k, 0);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    const [bu, bv] = bakeUv(uv.getX(i), uv.getY(i), b, fit);
    uv.setXY(i, bu, bv);
  }
  return g;
}

/** the geometry a layer takes at the live registration distance */
export function layerGeometry(l: Pick<Layer, "z" | "fit" | "relief" | "bounds">, baseZ: number): THREE.PlaneGeometry {
  return planeGeometry(l.z, baseZ, l.fit ?? FIT, segmentsFor(l.relief), l.bounds);
}

type MaterialOptions = {
  map: THREE.Texture;
  mask: THREE.Texture;
  depth: THREE.Texture;
  isFlame: number;
  /** 1 for the backdrop: no mask, no fade at the edges */
  flat: number;
  rect?: UvRect;
  depthUv?: UvRect;
  channel?: number;
  side?: CanvasSide;
};

type MaterialContext = {
  baseZ: number;
  /** the drawing buffer's size, for the front layers' vignette; one vector shared by every material */
  resolution: THREE.Vector2;
  beamGlow: number;
  flameDrift: boolean;
  /** a material's textures must upload to the renderer that draws it */
  warmOn: (t: THREE.Texture, side: CanvasSide) => void;
};

function cutMaterial(o: MaterialOptions, ctx: MaterialContext): THREE.ShaderMaterial {
  const side = o.side ?? "back";
  for (const t of [o.map, o.mask, o.depth]) ctx.warmOn(t, side);
  return new THREE.ShaderMaterial({
    uniforms: {
      uVignette: { value: side === "front" ? 1 : 0 },
      uResolution: { value: ctx.resolution },
      map: { value: o.map },
      mask: { value: o.mask },
      uMaskChannel: { value: new THREE.Vector4(...channelVector(o.channel ?? 0)) },
      depthMap: { value: o.depth },
      uMapRect: { value: new THREE.Vector4(...(o.rect ?? FULL_RECT)) },
      uDepthRect: { value: new THREE.Vector4(...(o.depthUv ?? FULL_RECT)) },
      uRelief: { value: 0 },
      uCamZ: { value: ctx.baseZ },
      uLayerZ: { value: 0 },
      uScale: { value: 1 },
      uBeam: { value: BEAM_REST },
      uBeamMax: { value: ctx.beamGlow },
      uFlameDrift: { value: ctx.flameDrift ? 1 : 0 },
      uIsFlame: { value: o.isFlame },
      uFit: { value: o.flat ? FIT_BG : FIT },
      uFlat: { value: o.flat },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: !o.flat,
    depthTest: false,
    depthWrite: false,
  });
}

export type BuildContext = MaterialContext & {
  /** where the planes go: the scene, or a group the fiber spike mounts as a primitive (#134) */
  scene: THREE.Object3D;
  textures: TextureSet;
  /** every texture by its file name in the tier, at its hashed url */
  url: TextureResolver;
  backdrop: THREE.Texture;
  depthMap: THREE.Texture;
  tier: TierName;
  /** without a front canvas every layer draws to the one canvas */
  sideOf: (side: CanvasSide) => CanvasSide;
};

export type BuiltLayers = { backdrop: Layer; layers: Layer[] };

/**
 * The backdrop and every cut, added to the scene in draw order. A complete
 * backdrop sits on a much larger plane at the same registration, so a cut
 * that moves reveals wall instead of a hole. A flame at parent.z +
 * FLAME_LIFT sorts right after its parent, so it draws over the head it
 * rests on and nothing else.
 */
export function buildLayers(cuts: Cut[], ctx: BuildContext): BuiltLayers {
  const bgMat = cutMaterial({ map: ctx.backdrop, mask: ctx.backdrop, depth: ctx.depthMap, isFlame: 0, flat: 1 }, ctx);
  bgMat.name = "backdrop";
  const bgMesh = new THREE.Mesh(planeGeometry(BACKDROP_Z, ctx.baseZ, FIT_BG), bgMat);
  bgMesh.name = "backdrop";
  bgMesh.position.z = BACKDROP_Z;
  bgMesh.renderOrder = 0;
  ctx.scene.add(assignLayer(bgMesh, "back"));
  const backdrop: Layer = { name: "backdrop", z: BACKDROP_Z, mesh: bgMesh, mat: bgMat, isFlame: 0, relief: 0, i: -1, side: "back", fit: FIT_BG };

  let flameOrdinal = 0;
  const layers = bindFlames(cuts)
    .sort((a, b) => a.z - b.z)
    .map((cut, i): Layer => {
      const ref = maskRef(cut, ctx.url);
      const mask = ctx.textures.mask(ref.url);
      // every cut's colour is its own crop of the plate over its mapRect (a
      // completed figure's holds the generated hidden pixels; the crowd's
      // the figures in front of it, inpainted over)
      const map = ctx.textures.load(ctx.url(cut.map), "colour");
      const depth = cut.depthMap ? ctx.textures.load(ctx.url(cut.depthMap), "depth") : ctx.depthMap;
      const side = ctx.sideOf(canvasFor(cut, 0, ctx.tier));
      const mat = cutMaterial(
        { map, mask, depth, isFlame: cut.isFlame, flat: 0, rect: rectToUv(cut.mapRect), depthUv: depthRect(cut), channel: ref.channel, side },
        ctx,
      );
      mat.name = cut.name;
      // each plane is scaled so every cut registers at the opening framing
      const bounds = maskBounds(cut.name);
      const mesh = new THREE.Mesh(planeGeometry(cut.z, ctx.baseZ, FIT, segmentsFor(cut.relief), bounds), mat);
      mesh.name = `cut-${cut.name}`;
      mesh.position.z = cut.z;
      mesh.renderOrder = i + 1;
      ctx.scene.add(assignLayer(mesh, side));
      const flame = cut.isFlame ? flameOrdinal++ : undefined;
      return { name: cut.name, z: cut.z, mesh, mat, isFlame: cut.isFlame, relief: cut.relief, i, side, at: cut.at, flame, parent: cut.parent, bounds };
    });
  return { backdrop, layers };
}
