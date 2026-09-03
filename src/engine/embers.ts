import * as THREE from "three";

import { VIGNETTE_GLSL } from "./vignette";

/**
 * Dust hanging in the air of the Pentecost scene: one THREE.Points draw in
 * front of `floor`. The motes are fixed points in the room — a barely-there
 * settle and sway is all the motion they have of their own — so what moves
 * them is the camera: the orbit and the dolly parallax them exactly as the
 * cuts. emberPose() is the executable spec the GLSL is transcribed from (as
 * displaceLocal is for the relief), so the settle, sway and wrap rules are
 * pinned by plain tests. (The module keeps its ember name from the sparks
 * it first drew.)
 *
 * What a mote looks like. Real dust is not one sprite: most of it is
 * pinpricks, a little is larger, and what is near the lens is a dim,
 * out-of-focus blob. So each mote draws a size from a distribution that
 * skews small (depth only nudges it), a softness that blends a hard-edged
 * fleck into a gaussian bokeh, an alpha that dims as it softens (the bright
 * ones are the small sharp glints), and one in four is a fibre — the same
 * sprite stretched along a random angle. A sharp fleck's rim ripples a little
 * so it is not a perfect disc; a soft one stays round. The look is packed per
 * mote as the aLook attribute; FRAG reads it.
 *
 * Where they live. Embers hold their authored depth (z 3.8–5) and take none
 * of the layer spread: they are not cut from the plate, so there is no
 * registration to preserve, and the spread would push them behind the
 * camera at the Visit stop (floor ends up at 5.8, the camera at ~6.3).
 *
 * How they stay in frame. The camera dollies from ~12 to ~6 and climbs to the
 * wall above the plate for the dove, so a fixed field the size of the plate
 * would be nearly empty at the near stops. Instead each ember's drifting
 * position is wrapped into a window that follows the camera laterally, like a
 * tiled field: inside the window an ember is a fixed world point and
 * parallaxes exactly as the cuts do; only at the edges does it re-enter on
 * the far side. The same wrap is what returns a risen ember to the bottom.
 * The window is the frustum at the ember's depth as seen from the
 * registration distance (baseZ, the hero framing) plus a margin — a fixed
 * world size, so the cloud's density per world area never changes: the hero
 * shows the whole field, and the near stops show fewer, larger embers, the
 * way a real cloud thins as you move into it.
 */

/** authored depth band: in front of floor (3.6), short of where the camera dollies to */
export const EMBER_Z = { min: 3.8, max: 5 } as const;

/** the plate's extent, where the rest positions are scattered */
export const EMBER_FIELD = { halfW: 8, halfH: (8 * 2519) / 2048 } as const;

/** vertical settle, world units per second — either way, and hardly at all */
export const EMBER_SPEED = { min: -0.012, max: 0.012 } as const;

/** world diameter of a sprite: pinpricks at the small end, the rare near blob at the large */
export const EMBER_SIZE = { min: 0.012, max: 0.11 } as const;

/**
 * how the size draw is shaped: `skew` raises the uniform draw (higher skews
 * smaller), and `depth` is the share of the ramp the mote's nearness adds
 */
const EMBER_SIZE_SHAPE = { skew: 3, depth: 0.2 } as const;

/** lateral sway amplitude in world units */
const EMBER_WOBBLE = { min: 0.008, max: 0.03 } as const;

/** radians per second of the sway */
const WOBBLE_RATE = 0.22;

/** dust catching the light: the cream, a little grey */
const EMBER_TINT: [number, number, number] = [0.9, 0.86, 0.78];

/** a mote's alpha, steady — dust does not flicker; a sharp glint gets `sharp`, a bokeh blob `soft` */
export const EMBER_ALPHA = { sharp: 0.5, soft: 0.2 } as const;

/** share of motes drawn as fibres, and how far a fibre stretches (1 is a disc) */
export const EMBER_FIBRE = { share: 0.25, stretch: { min: 1.8, max: 3.5 } } as const;

/** the wrap window overshoots the frustum by this factor so re-entries happen off screen */
const EMBER_MARGIN = 1.15;

export const EMBER_COUNT = {
  min: 70,
  max: 140,
  mobile: 24,
  /** the viewport (in device pixels) that gets `min` embers */
  refArea: 1280 * 720,
} as const;

type EmberTier = "desktop" | "mobile";

export type EmberCountInputs = {
  width: number;
  height: number;
  dpr: number;
  reducedMotion: boolean;
  tier?: EmberTier;
};

/**
 * How many embers a viewport gets: none under reduced motion, a fixed handful
 * on the mobile tier, otherwise 70–140 growing with the device-pixel area
 * (DPR clamped at 2, as the renderer clamps it).
 */
export function emberCount({ width, height, dpr, reducedMotion, tier = "desktop" }: EmberCountInputs): number {
  if (reducedMotion) return 0;
  if (tier === "mobile") return EMBER_COUNT.mobile;
  const area = width * height * Math.min(dpr, 2);
  const scaled = Math.round((EMBER_COUNT.min * area) / EMBER_COUNT.refArea);
  return Math.min(EMBER_COUNT.max, Math.max(EMBER_COUNT.min, scaled));
}

export type EmberSeeds = {
  count: number;
  /** x y z per ember: the rest position the drift plays out from */
  origin: Float32Array;
  /** upward drift, world units per second */
  speed: Float32Array;
  /** wobble and flicker phase, radians */
  phase: Float32Array;
  /** world diameter */
  size: Float32Array;
  /** lateral wobble amplitude */
  wobble: Float32Array;
  /** 0 a hard-edged fleck, 1 an out-of-focus blob */
  softness: Float32Array;
  /** the mote's own alpha */
  alpha: Float32Array;
  /** 1 a disc; more, a fibre that long along its axis */
  stretch: Float32Array;
  /** the fibre's axis, radians */
  angle: Float32Array;
};

/** mulberry32: a tiny deterministic PRNG so a seed always scatters the same field */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Deterministic rest positions across the plate's extent with z in the depth
 * band; per ember a drift speed, a phase, a wobble amplitude, and a look:
 * a size drawn small-skewed (nearness adds a little), a softness that grows
 * with the size and a little chance, an alpha that dims as it softens, and
 * for a quarter of them a fibre's stretch and angle.
 */
export function seedEmbers(count: number, seed = 1): EmberSeeds {
  const rand = prng(seed);
  const origin = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  const phase = new Float32Array(count);
  const size = new Float32Array(count);
  const wobble = new Float32Array(count);
  const softness = new Float32Array(count);
  const alpha = new Float32Array(count);
  const stretch = new Float32Array(count);
  const angle = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const depth01 = rand();
    origin[i * 3] = lerp(-EMBER_FIELD.halfW, EMBER_FIELD.halfW, rand());
    origin[i * 3 + 1] = lerp(-EMBER_FIELD.halfH, EMBER_FIELD.halfH, rand());
    origin[i * 3 + 2] = lerp(EMBER_Z.min, EMBER_Z.max, depth01);
    speed[i] = lerp(EMBER_SPEED.min, EMBER_SPEED.max, rand());
    phase[i] = rand() * Math.PI * 2;
    wobble[i] = lerp(EMBER_WOBBLE.min, EMBER_WOBBLE.max, rand());
    // most motes are pinpricks: the draw is raised to skew it small, and nearness adds a little
    const { skew, depth } = EMBER_SIZE_SHAPE;
    const size01 = Math.pow(rand(), skew) * (1 - depth) + depth01 * depth;
    size[i] = lerp(EMBER_SIZE.min, EMBER_SIZE.max, size01);
    // the large ones are the out-of-focus ones, mostly; chance blurs the rule
    softness[i] = clamp01(0.1 + size01 * 0.7 + (rand() - 0.5) * 0.5);
    alpha[i] = lerp(EMBER_ALPHA.sharp, EMBER_ALPHA.soft, softness[i]) * lerp(0.7, 1, rand());
    const fibre = rand() < EMBER_FIBRE.share;
    stretch[i] = fibre ? lerp(EMBER_FIBRE.stretch.min, EMBER_FIBRE.stretch.max, rand()) : 1;
    angle[i] = rand() * Math.PI;
  }
  return { count, origin, speed, phase, size, wobble, softness, alpha, stretch, angle };
}

export type EmberWindow = { cx: number; cy: number; halfW: number; halfH: number };

/** `v` folded into [centre − half, centre + half): past the top comes back in at the bottom */
/**
 * The point-size ceiling in device px (#62): every sprite pixel is blended
 * fill on top of the whole stack, so the near bokeh motes stop at 40 px —
 * a quarter of the old 80 px worst-case area — and shrink with a short frame.
 */
export function emberMaxPx(heightPx: number): number {
  return Math.min(40, heightPx * 0.06);
}

export function wrapInto(v: number, centre: number, half: number): number {
  const span = 2 * half;
  const d = v - centre + half;
  return centre + (((d % span) + span) % span) - half;
}

/**
 * The wrap window for an ember at depth `z`: centred on the camera, sized to
 * the frustum at that depth as seen from `refZ` (the registration distance,
 * so the size holds while the camera dollies), widened by `margin`. Keep in
 * sync with VERT.
 */
export function emberWindow(
  cam: { x: number; y: number },
  z: number,
  refZ: number,
  tanHalfFov: number,
  aspect: number,
  margin = EMBER_MARGIN,
): EmberWindow {
  const halfH = (refZ - z) * tanHalfFov * margin;
  return { cx: cam.x, cy: cam.y, halfW: halfH * aspect, halfH };
}

/** where mote `i` is at time `t`: settled, swayed, and wrapped into the window. Keep in sync with VERT. */
export function emberPose(seeds: EmberSeeds, i: number, t: number, w: EmberWindow): { x: number; y: number; z: number } {
  const x = seeds.origin[i * 3] + seeds.wobble[i] * Math.sin(t * WOBBLE_RATE + seeds.phase[i]);
  const y = seeds.origin[i * 3 + 1] + seeds.speed[i] * t;
  return { x: wrapInto(x, w.cx, w.halfW), y: wrapInto(y, w.cy, w.halfH), z: seeds.origin[i * 3 + 2] };
}

export type EmberState = { seeds: EmberSeeds; time: number; positions: Float32Array };

export function createEmberState(seeds: EmberSeeds): EmberState {
  return { seeds, time: 0, positions: Float32Array.from(seeds.origin) };
}

const PLATE_WINDOW: EmberWindow = { cx: 0, cy: 0, halfW: EMBER_FIELD.halfW, halfH: EMBER_FIELD.halfH };

/**
 * The CPU form of the animation: step the clock and rewrite every position
 * from emberPose. The layer itself never calls this — the shader does the
 * same arithmetic from uTime — it is here so the motion can be tested.
 */
export function advance(state: EmberState, dt: number, w: EmberWindow = PLATE_WINDOW): void {
  state.time += dt;
  for (let i = 0; i < state.seeds.count; i++) {
    const p = emberPose(state.seeds, i, state.time, w);
    state.positions[i * 3] = p.x;
    state.positions[i * 3 + 1] = p.y;
    state.positions[i * 3 + 2] = p.z;
  }
}

/**
 * Layer opacity against the unclamped section progress (index + fraction, the
 * viewport centre's place in the scene stack). Full through the scene; across
 * the last section it eases out — still three quarters at the section's
 * midpoint, where the sticky canvas begins to slide away — reaching 0 as the
 * viewport centre leaves the scene for the long-form.
 */
export function emberOpacity(sceneProgress: number, sceneCount: number): number {
  if (sceneCount < 2) return 1;
  const u = Math.min(1, Math.max(0, sceneProgress - (sceneCount - 1)));
  return 1 - u * u;
}

// transcribed from emberWindow() and emberPose() above
const VERT = `
uniform float uTime, uTan, uAspect, uMargin, uPxPerUnit, uMaxPx, uRefZ;
uniform vec3 uCam;
// speed, phase, size, wobble
attribute vec4 aSeed;
// softness, alpha, stretch, angle
attribute vec4 aLook;
varying float vAlpha, vPhase;
varying vec4 vLook;
float wrapInto(float v, float c, float h) { return c + mod(v - c + h, 2.0 * h) - h; }
void main() {
  vLook = aLook;
  vPhase = aSeed.y;
  float halfH = (uRefZ - position.z) * uTan * uMargin;
  float halfW = halfH * uAspect;
  float x = wrapInto(position.x + aSeed.w * sin(uTime * ${WOBBLE_RATE.toFixed(3)} + aSeed.y), uCam.x, halfW);
  float y = wrapInto(position.y + aSeed.x * uTime, uCam.y, halfH);
  vec4 mv = modelViewMatrix * vec4(x, y, position.z, 1.0);
  float dist = max(0.05, -mv.z);
  // a mote's world diameter projected to device pixels; a bokeh blob's falloff needs the room, so it draws larger
  gl_PointSize = clamp(aSeed.z * (1.0 + 0.6 * aLook.x) * uPxPerUnit / dist, 1.0, uMaxPx);
  // a mote about to pass the camera would fill the frame — let it go instead
  vAlpha = aLook.y * smoothstep(0.3, 1.4, dist);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = `
uniform vec3 uTint;
uniform float uOpacity, uVignette;
uniform vec2 uResolution;
varying float vAlpha, vPhase;
varying vec4 vLook;
${VIGNETTE_GLSL}
void main() {
  vec2 p = gl_PointCoord - 0.5;
  // a fibre: the sprite turned to its angle and narrowed across it
  float c = cos(vLook.w), s = sin(vLook.w);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  p.y *= vLook.z;
  float r = length(p) * 2.0;
  // a sharp fleck is not a perfect disc: a small ripple on its rim, fading out as it softens
  float ang = atan(p.y, p.x);
  float rim = 1.0 - (1.0 - vLook.x) * 0.16 * (0.6 * sin(ang * 3.0 + vPhase) + 0.4 * sin(ang * 5.0 - vPhase * 1.7));
  r /= rim;
  if (r > 1.0) discard;
  // a hard edge for a fleck, a gaussian falloff for an out-of-focus blob; softness blends them
  float soft = smoothstep(1.0, 0.0, r);
  soft *= soft;
  float sharp = smoothstep(1.0, 0.55, r);
  float a = mix(sharp, soft, vLook.x);
  vec3 col = uTint;
  // the front canvas has no DOM vignette over it: dim the ember by the same falloff here
  float v = 1.0 - vignetteAlpha(gl_FragCoord.xy, uResolution) * uVignette;
  gl_FragColor = vec4(col, a * vAlpha * uOpacity * v);
}`;

type EmberFrame = {
  /** scene seconds */
  t: number;
  /** unclamped section progress: index + fraction through it */
  progress: number;
  /** number of scene sections */
  sectionCount: number;
  /** drawing-buffer height in device pixels (gl_PointSize is in device pixels) */
  heightPx: number;
  /** the registration camera distance (baseZ): sizes the wrap window */
  refZ: number;
};

export type EmberLayer = {
  points: THREE.Points;
  update(frame: EmberFrame): void;
  dispose(): void;
};

export type CreateEmbersOptions = {
  scene: THREE.Object3D;
  camera: THREE.PerspectiveCamera;
  count: number;
  seed?: number;
  /** drawn after everything in the scene */
  renderOrder?: number;
  /**
   * the drawing buffer's size, when the embers draw to the front canvas: it
   * has no DOM vignette, so the shader applies the scene's own (vignette.ts)
   */
  resolution?: THREE.Vector2;
};

/**
 * One Points draw of `count` embers added to `scene`. Nothing is uploaded per
 * frame: update() sets uniforms only. Ordinary over-compositing rather than
 * additive: on the transparent front canvas an additive sprite would write
 * its full alpha and land as a black square over the page.
 */
export function createEmbers({
  scene,
  camera,
  count,
  seed = 1,
  renderOrder = 1000,
  resolution,
}: CreateEmbersOptions): EmberLayer {
  const seeds = seedEmbers(count, seed);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(seeds.origin, 3));
  const packed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    packed[i * 4] = seeds.speed[i];
    packed[i * 4 + 1] = seeds.phase[i];
    packed[i * 4 + 2] = seeds.size[i];
    packed[i * 4 + 3] = seeds.wobble[i];
  }
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(packed, 4));
  const look = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    look[i * 4] = seeds.softness[i];
    look[i * 4 + 1] = seeds.alpha[i];
    look[i * 4 + 2] = seeds.stretch[i];
    look[i * 4 + 3] = seeds.angle[i];
  }
  geometry.setAttribute("aLook", new THREE.BufferAttribute(look, 4));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uTan: { value: Math.tan(((camera.fov * Math.PI) / 180) / 2) },
      uAspect: { value: camera.aspect },
      uMargin: { value: EMBER_MARGIN },
      uPxPerUnit: { value: 1 },
      uMaxPx: { value: 40 },
      uRefZ: { value: camera.position.z },
      uCam: { value: new THREE.Vector3() },
      uTint: { value: new THREE.Vector3(...EMBER_TINT) },
      uOpacity: { value: 1 },
      uVignette: { value: resolution ? 1 : 0 },
      uResolution: { value: resolution ?? new THREE.Vector2(1, 1) },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    blending: THREE.NormalBlending,
    depthTest: false,
    depthWrite: false,
  });
  material.name = "embers";

  const points = new THREE.Points(geometry, material);
  points.name = "embers";
  points.renderOrder = renderOrder;
  // the shader relocates every vertex, so the geometry's bounds mean nothing
  points.frustumCulled = false;
  points.visible = count > 0;
  scene.add(points);

  return {
    points,
    update({ t, progress, sectionCount, heightPx, refZ }) {
      const u = material.uniforms;
      const tan = Math.tan(((camera.fov * Math.PI) / 180) / 2);
      u.uTime.value = t;
      u.uTan.value = tan;
      u.uAspect.value = camera.aspect;
      u.uRefZ.value = refZ;
      u.uPxPerUnit.value = heightPx / (2 * tan);
      u.uMaxPx.value = emberMaxPx(heightPx);
      (u.uCam.value as THREE.Vector3).copy(camera.position);
      u.uOpacity.value = emberOpacity(progress, sectionCount);
    },
    dispose() {
      scene.remove(points);
      geometry.dispose();
      material.dispose();
    },
  };
}
