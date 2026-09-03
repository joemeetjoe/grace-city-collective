/**
 * Pure math and manifest helpers for the per-figure depth relief in
 * PentecostParallax. displaceLocal/reliefDz are the executable spec the
 * displacement vertex shader is transcribed from — the projection-invariance
 * test pins the algebra the GLSL must reproduce.
 */

import type { MaskRef } from "@/device/textureManifest";

export type Cut = {
  name: string;
  z: number;
  isFlame: number;
  relief: number;
  /** the cut's own color texture: a crop of the plate (there is no whole-plate texture, #99) */
  map: string;
  /** the plate rectangle `map` covers, [x, y, w, h] as fractions of the plate from its top-left */
  mapRect: PlateRect;
  /**
   * dedicated depth texture covering the same rectangle as `map`; absent =
   * the shared depth.webp, which is still the whole plate (see depthRect)
   */
  depthMap?: string;
  /** a flame's cut it hangs over — a figure, or the crowd */
  parent?: string;
  /**
   * the cut's centre (its mask centroid) as [u, v] plate fractions from the
   * top-left. A flame's is the point that leaves the head for the dove (see
   * flamePose); a figure's is what huddleShift slides it toward the centre by
   */
  at?: [number, number];
  /** the packed mask texture and channel; absent = its own cut-<name>.png */
  mask?: MaskRef;
};

/** a plate rectangle [x, y, w, h] in plate fractions, y down from the top */
export type PlateRect = readonly [number, number, number, number];

export type UvRect = [number, number, number, number];

/** the whole plate, in uv terms */
export const FULL_RECT: UvRect = [0, 0, 1, 1];

/**
 * A map rectangle in plate fractions (y down from the top) as a uv rectangle
 * (three.js flips textures, so v runs up from the bottom): [x, y, w, h].
 */
export function rectToUv(rect: PlateRect): UvRect {
  const [x, y, w, h] = rect;
  return [x, 1 - y - h, w, h];
}

/**
 * The uv rectangle a cut's depth is sampled over. A cut's own depth map is
 * cut from the same window as its colour map; the shared depth.webp is the
 * whole plate, so a cut without one keeps plate uv there even though its
 * colour now comes from a crop.
 */
export function depthRect(cut: Pick<Cut, "mapRect" | "depthMap">): UvRect {
  return cut.depthMap ? rectToUv(cut.mapRect) : FULL_RECT;
}

type RawCut = Omit<Cut, "relief" | "map" | "mapRect"> & { relief?: number; map?: string; mapRect?: PlateRect };

/** the tier's cuts.json; every cut must name its map and the plate rect it covers */
export function parseCuts(raw: unknown): Cut[] {
  return (raw as RawCut[]).map((c) => {
    if (!c.map || !c.mapRect) throw new Error(`cut ${c.name} has no map of its own`);
    return { ...c, map: c.map, mapRect: c.mapRect, relief: c.relief ?? 0 };
  });
}

/**
 * The huddle: every figure slides toward the plate's centre line by this
 * fraction of its centroid's offset from it. The cuts are eroded 2 px and
 * feathered (issue #28) and the camera's lateral travel shears the planes
 * apart, so where two robes touched on the plate a sliver of wall shows;
 * a rigid shift per figure closes it (a uniform x-scale would scale the gaps
 * along with everything else). A flame rides its parent's shift.
 */
export const HUDDLE = 0.1;

/**
 * A cut's huddle shift in plate widths: huddle * (0.5 - u) for a cut with
 * an anchor, toward the centre on both sides; nothing without one (the
 * crowd, floor, arch and dove stay where the plate has them).
 */
export function huddleShift(at: [number, number] | undefined, huddle = HUDDLE): number {
  return at ? huddle * (0.5 - at[0]) : 0;
}

/** how far in front of its parent a flame rests — same parallax plane, drawn just after it */
export const FLAME_LIFT = 0.05;

/**
 * Every flame at rest on the head it hangs over: its z becomes the parent's
 * plus FLAME_LIFT, so it rides the same plane and registers on the head at
 * the hero framing. A flame whose parent is not in the scene keeps its
 * authored z. Nothing else changes; the input is left untouched.
 */
export function bindFlames(cuts: Cut[]): Cut[] {
  const zOf = new Map(cuts.map((c) => [c.name, c.z]));
  return cuts.map((c) => {
    const parentZ = c.isFlame && c.parent !== undefined ? zOf.get(c.parent) : undefined;
    return parentZ === undefined ? c : { ...c, z: parentZ + FLAME_LIFT };
  });
}

/**
 * Plane segments for a cut — relief needs vertices to displace, flat cuts
 * don't. Half the original density on each axis (#67): each vertex costs a
 * dependent depth-texture fetch — the slowest vertex work on phones and
 * integrated GPUs — and the depth maps are smooth gradients, so a quarter of
 * the vertices bow the figures identically (screenshot-verified at the
 * deep-dolly stops).
 */
export function segmentsFor(relief: number): [number, number] {
  return relief ? [48, 59] : [1, 1];
}

/** world-space displacement for one depth sample; 0.5 is the plate's rest plane */
export function reliefDz(depth01: number, relief: number): number {
  return (depth01 - 0.5) * relief;
}

export type ReliefUniforms = { uCamZ: number; uLayerZ: number; uScale: number };

/**
 * Per-frame relief uniforms for a layer. uCamZ is the registration camera at
 * baseZ — the viewpoint geom() authors every plane against — not the live
 * camera; uScale is the mesh's live scale, needed to apply a world-space dz
 * in local units.
 */
export function reliefUniforms(baseZ: number, restZ: number, liveZ: number): ReliefUniforms {
  return { uCamZ: baseZ, uLayerZ: liveZ, uScale: (baseZ - liveZ) / (baseZ - restZ) };
}

/** the vertex shader's displacement, in mesh-local space — keep in sync with VERT */
export function displaceLocal(
  local: { x: number; y: number },
  depth01: number,
  u: ReliefUniforms & { uRelief: number },
): { x: number; y: number; z: number } {
  const dz = reliefDz(depth01, u.uRelief);
  const shrink = (u.uCamZ - u.uLayerZ - dz) / (u.uCamZ - u.uLayerZ);
  // dz is a world distance but the mesh is rescaled every frame, so it must be
  // applied in local units or the xy compensation no longer cancels it
  return { x: local.x * shrink, y: local.y * shrink, z: dz / u.uScale };
}

/** the luminance band a flame's alpha ramps over: below is wall, above is tongue */
export const FLAME_KEY: [number, number] = [0.16, 0.44];

function smoothstep(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * The fragment shader's flame key — keep in sync with FRAG. A flame cut's
 * feathered mask carries a rim of the dark wall around the tongue; keying
 * the alpha on luminance drops that rim so a risen flame doesn't smudge the
 * beam. Non-flame cuts (isFlame 0) pass through.
 */
export function flameKey(lum: number, isFlame = 1): number {
  const key = smoothstep(FLAME_KEY[0], FLAME_KEY[1], lum);
  return 1 - isFlame + isFlame * key;
}
