/**
 * Pure math and manifest helpers for the per-figure depth relief in
 * PentecostParallax. displaceLocal/reliefDz are the executable spec the
 * displacement vertex shader is transcribed from — the projection-invariance
 * test pins the algebra the GLSL must reproduce.
 */

export type Cut = {
  name: string;
  z: number;
  isFlame: number;
  relief: number;
  /** dedicated color texture; cuts without one sample the shared plate */
  map?: string;
};

type RawCut = Omit<Cut, "relief"> & { relief?: number };

export function parseCuts(raw: unknown): Cut[] {
  return (raw as RawCut[]).map((c) => ({ ...c, relief: c.relief ?? 0 }));
}

/** plane segments for a cut — relief needs vertices to displace, flat cuts don't */
export function segmentsFor(relief: number): [number, number] {
  return relief ? [96, 118] : [1, 1];
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
