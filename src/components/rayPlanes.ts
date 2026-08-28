import * as THREE from "three";

/**
 * The light from the dove as a handful of translucent ray planes, each on its
 * own depth between the dove and the crowd. Because they sit at different z,
 * the orbit and the dolly slide them against the arch and the apostles cross
 * in front of them — the flat beam that used to be painted into every cut's
 * fragment shader had no depth to give.
 *
 * raySpecs / rayIntensity / rayRenderOrder / projectToPlane are pure and
 * pinned by tests; createRayLayer turns the specs into meshes for
 * PentecostParallax.
 */

/** the dove's plane — no ray sits behind it */
export const RAY_FAR_Z = -3.0;
/**
 * the crowd's plane — no ray sits in front of it. Its cut is an opaque
 * rectangle (v 0.81 down to 0.40, wall included), so the rays are DRAWN just
 * after it while keeping their own depth behind it: they wash the wall and
 * the back row as the flat beam did, and the apostle cuts still cross in front
 */
export const RAY_NEAR_Z = -0.9;
/** the widest the fan opens, degrees either side of vertical */
export const RAY_FAN_DEG = 22;
export type Vec3 = { x: number; y: number; z: number };
export type PlateSize = { w: number; h: number };

/**
 * World position of a plate uv (v up) on a plane at live z — the plane is
 * sized so that from the registration camera at (0, 0, baseZ) every plane
 * shows the plate at the same size.
 */
export function platePoint(u: number, v: number, z: number, baseZ: number, plate: PlateSize): Vec3 {
  const k = (baseZ - z) / baseZ;
  return { x: (u - 0.5) * plate.w * k, y: (v - 0.5) * plate.h * k, z };
}

/**
 * The plate uv (v up) on a plane at `planeZ` that the camera sees exactly over
 * `point`. From the registration camera this is the point's own plate uv; once
 * the camera moves, a nearer plane needs a different uv to stay under it —
 * which is how the fan's apex stays pinned to the dove through the dolly.
 */
export function projectToPlane(cam: Vec3, point: Vec3, planeZ: number, baseZ: number, plate: PlateSize): [number, number] {
  const t = (cam.z - planeZ) / (cam.z - point.z);
  const x = cam.x + (point.x - cam.x) * t;
  const y = cam.y + (point.y - cam.y) * t;
  const k = (baseZ - planeZ) / baseZ;
  return [x / (plate.w * k) + 0.5, y / (plate.h * k) + 0.5];
}

export type RaySpec = {
  /** rest z, authored against the registration camera like the cuts */
  z: number;
  /** tilt from vertical in degrees; positive leans to the right of the plate */
  angle: number;
  /** Gaussian half-width at the foot of the ray, as a fraction of plate width */
  width: number;
  /** Gaussian half-width where the ray leaves the dove */
  top: number;
  /** relative brightness */
  gain: number;
  /** shimmer phase, so the rays never breathe in step */
  phase: number;
};

/** mulberry32 — a tiny seeded generator so a count always yields the same fan */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `count` rays fanning out from the dove: angles evenly spread and symmetric
 * about vertical (the fan opens with the count, up to ±RAY_FAN_DEG), each on
 * its own depth slot between the dove and the crowd — the slots are shuffled
 * so the fan's neighbours never sit at neighbouring depths, which is what
 * makes them slide past each other under the orbit.
 */
export function raySpecs(count: number, seed = 1): RaySpec[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  const rng = seeded(seed);
  const fan = Math.min(RAY_FAN_DEG, 11 * (n - 1));

  // depth slots, kept clear of the arch (−2.8) behind and the crowd in front
  const zFar = RAY_FAR_Z + 0.25;
  const zNear = RAY_NEAR_Z - 0.25;
  const slot = (zNear - zFar) / n;
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }

  return order.map((k, i) => {
    const angle = n === 1 ? 0 : -fan + (2 * fan * i) / (n - 1);
    // jitter stays well inside the slot, so no two rays share a plane
    const z = zFar + slot * (k + 0.5 + (rng() - 0.5) * 0.3);
    const width = 0.05 + 0.055 * rng();
    // the rays nearer the vertical carry more of the light
    const gain = (0.5 + 0.2 * rng()) * (1 - 0.35 * (Math.abs(angle) / RAY_FAN_DEG));
    return { z, angle, width, top: width * 0.18, gain, phase: rng() * Math.PI * 2 };
  });
}

/**
 * Brightness against normalised scene progress (0 at the hero, 1 at the last
 * waypoint) — the same ramp the flat beam followed.
 */
export function rayIntensity(progress: number): number {
  const p = Math.min(1, Math.max(0, progress));
  return 0.3 + Math.pow(p, 1.15) * 0.95;
}

/**
 * Where a ray draws in the cut stack. Cuts sort by z ascending and draw at
 * renderOrder i + 1 with depth testing off, so a ray slots in at a half step:
 * after every cut at or behind its z, before the first one in front.
 */
export function rayRenderOrder(sortedLayerZ: number[], z: number): number {
  const front = sortedLayerZ.findIndex((lz) => lz > z);
  return (front < 0 ? sortedLayerZ.length : front) + 0.5;
}

// how much brighter the plate gets under a ray at full intensity, relative
const RAY_LIGHT = 1.6;

const VERT = `
uniform float uFit;
varying vec2 vUv;
void main(){
  vUv = (uv - 0.5) / uFit + 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FRAG = `
uniform float uTime, uIntensity, uBeamMax, uAspect, uPhase, uGain, uWidth, uTop;
#define RAY_LIGHT ${RAY_LIGHT.toFixed(2)}
uniform vec2 uOrigin, uDir;
varying vec2 vUv;
void main(){
  // plate-width units on both axes, so a width means the same thing everywhere
  vec2 p = (vUv - uOrigin) * vec2(1.0, uAspect);
  float s = dot(p, uDir);
  float q = dot(p, vec2(uDir.y, -uDir.x));
  // clamp before pow(): above the dove s goes negative, and pow() with a
  // negative base is undefined in GLSL — NaN would blacken the whole plane.
  // The wedge opens over the first third of the plate, where it is seen
  float t = clamp(s / 0.35, 0.0, 1.0);
  float breath = 1.0 + 0.05 * sin(uTime * 0.21 + uPhase);
  float sigma = mix(uTop, uWidth, pow(t, 0.7)) * breath;
  // the light thins as it spreads
  float across = exp(-q * q / (2.0 * sigma * sigma)) * pow(uTop / sigma, 0.3);
  float emerge = smoothstep(0.0, 0.12, s);
  float fall = 1.0 - smoothstep(0.35, 0.9, s);
  float shimmer = 0.82 + 0.18 * sin(uTime * 0.37 + uPhase + s * 5.0);
  // the plane is deliberately larger than the plate: fade before its own edge
  vec2 e = smoothstep(vec2(-0.17), vec2(-0.06), vUv) * smoothstep(vec2(1.17), vec2(1.06), vUv);
  float b = across * emerge * fall * shimmer * e.x * e.y * uGain;
  // additive: the colour is the contribution, so the overall alpha
  // (uIntensity * uBeamMax) multiplies it here rather than saturating at 1
  // multiplicative light needs more gain than the additive glow it replaces:
  // the wall it lands on is dark, so the same b moves it far less
  gl_FragColor = vec4(vec3(0.98, 0.90, 0.72) * b * uIntensity * uBeamMax * RAY_LIGHT, 1.0);
}`;

export type RayFrame = {
  time: number;
  intensity: number;
  glow: number;
  /** the live spread the cuts use: a plane sits at rest z × zScale */
  zScale: number;
  /** the registration camera's distance */
  baseZ: number;
  /** the live camera */
  cam: Vec3;
};

export type RayLayer = {
  meshes: THREE.Mesh[];
  update(frame: RayFrame): void;
  /** the plate plane depends on the viewport — rebuild alongside the cuts */
  resize(): void;
  dispose(): void;
};

export type RayLayerOptions = {
  /** the plate plane for a rest z, exactly as the cuts get theirs */
  geom: (z: number) => THREE.BufferGeometry;
  /** the cuts' plane oversize — the ray's uv maps to the plate through it */
  fit: number;
  /** the plate's world size at the registration camera */
  plate: PlateSize;
  /** the dove in plate uv, v up */
  origin: [number, number];
  /** where a ray draws in the cut stack (see RAY_NEAR_Z) */
  renderOrder: () => number;
};

export function createRayLayer(specs: RaySpec[], opts: RayLayerOptions): RayLayer {
  const rays = specs.map((spec, i) => {
    const a = (spec.angle * Math.PI) / 180;
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uFit: { value: opts.fit },
        uTime: { value: 0 },
        uIntensity: { value: 0.3 },
        uBeamMax: { value: 1 },
        uAspect: { value: opts.plate.h / opts.plate.w },
        uPhase: { value: spec.phase },
        uGain: { value: spec.gain },
        uWidth: { value: spec.width },
        uTop: { value: spec.top },
        uOrigin: { value: new THREE.Vector2(opts.origin[0], opts.origin[1]) },
        // down the plate, leaning by the angle
        uDir: { value: new THREE.Vector2(Math.sin(a), -Math.cos(a)) },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      // light on an engraving scales the plate's own tone: out = dst * (1 + ray).
      // Additive glow lifts the dark hatching to flat grey, and everything the
      // rays cross in the backdrop (the uncut apostles) turns to blurred wall
      // under the crisp cut heads
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.DstColorFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.ZeroFactor,
      blendDstAlpha: THREE.OneFactor,
      depthTest: false,
      depthWrite: false,
    });
    mat.name = `ray-${i}`;
    const mesh = new THREE.Mesh(opts.geom(spec.z), mat);
    mesh.name = `ray-${i}`;
    mesh.position.z = spec.z;
    mesh.renderOrder = opts.renderOrder();
    return { spec, mesh, mat };
  });

  return {
    meshes: rays.map((r) => r.mesh),
    update({ time, intensity, glow, zScale, baseZ, cam }) {
      // the dove, where it is this frame
      const dove = platePoint(opts.origin[0], opts.origin[1], RAY_FAR_Z * zScale, baseZ, opts.plate);
      for (const r of rays) {
        r.mat.uniforms.uTime.value = time;
        r.mat.uniforms.uIntensity.value = intensity;
        r.mat.uniforms.uBeamMax.value = glow;
        // the same spread-and-rescale the cuts get, so the rays never pop
        // against them as the depth opens
        const zn = r.spec.z * zScale;
        r.mesh.position.z = zn;
        r.mesh.scale.setScalar((baseZ - zn) / (baseZ - r.spec.z));
        // a nearer plane slides against the dove under the camera; re-aim the
        // apex so the fan always leaves the dove itself
        const [ou, ov] = projectToPlane(cam, dove, zn, baseZ, opts.plate);
        r.mat.uniforms.uOrigin.value.set(ou, ov);
      }
    },
    resize() {
      for (const r of rays) {
        r.mesh.geometry.dispose();
        r.mesh.geometry = opts.geom(r.spec.z);
      }
    },
    dispose() {
      for (const r of rays) {
        r.mesh.geometry.dispose();
        r.mat.dispose();
      }
    },
  };
}
