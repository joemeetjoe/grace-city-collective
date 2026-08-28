/**
 * Pure maths for the pointer-driven camera in PentecostParallax.
 *
 * The pointer used to nudge the camera's *position* by a tenth of a world
 * unit, which barely read as depth. Now it orbits the camera around the point
 * it looks at, on the plate plane: near apostles swing one way across the far
 * arch, the arch swings the other, and the plate itself stays put on screen.
 * A small slide (the old nudge) rides on top, still confined to the lateral
 * budget that keeps the inpainted wall behind the figures out of frame.
 */

export type Vec3 = { x: number; y: number; z: number };
export type Pointer = { x: number; y: number };

export type OrbitOptions = {
  /** half-swing about the vertical axis, degrees, at pointer.x = ±1 */
  yawDeg: number;
  /** half-swing about the horizontal axis, degrees, at pointer.y = ±1 */
  pitchDeg: number;
  /** pan of the whole frame, world units per unit of pointer */
  slide: number;
  /** the frame centre is confined to ±limit — the slide's wall guard */
  limit?: { x: number; y: number };
};

export type Pose = { position: Vec3; target: Vec3 };

/**
 * How far past the slide's lateral budget the orbit may carry the camera. An
 * orbit of θ at distance d shears the layers exactly as a slide of d·sin θ
 * would, but keeps the plate plane centred, so the exposed wall sits at the
 * frame's edge rather than behind a centred figure — it tolerates more.
 * Tuned by eye against the deepest dolly (house churches).
 */
export const ORBIT_LATERAL_FACTOR = 1.3;

const RAD = Math.PI / 180;
const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

/**
 * Camera position and look-at for a pointer in −1..1. `eye` is the un-orbited
 * frame: the camera sits there looking straight down −z at (eye.x, eye.y, 0),
 * and that plate-plane point is the pivot. The camera swings *away* from the
 * cursor (cursor right → camera on the left), the sign the slide always had,
 * so the near figures follow the cursor. The distance to the pivot is
 * preserved, so the dolly is untouched.
 */
export function orbitPose(eye: Vec3, pointer: Pointer, opts: OrbitOptions): Pose {
  const px = clamp1(pointer.x);
  const py = clamp1(pointer.y);

  let cx = eye.x - px * opts.slide;
  let cy = eye.y - py * opts.slide;
  if (opts.limit) {
    cx = Math.max(-opts.limit.x, Math.min(opts.limit.x, cx));
    cy = Math.max(-opts.limit.y, Math.min(opts.limit.y, cy));
  }
  const target = { x: cx, y: cy, z: 0 };

  const d = eye.z;
  const yaw = -px * opts.yawDeg * RAD;
  const pitch = -py * opts.pitchDeg * RAD;
  const cp = Math.cos(pitch);
  const position = {
    x: cx + d * Math.sin(yaw) * cp,
    y: cy + d * Math.sin(pitch),
    z: d * Math.cos(yaw) * cp,
  };
  return { position, target };
}

/**
 * The largest yaw (degrees) whose lateral travel at `distance` stays within
 * `budget × ORBIT_LATERAL_FACTOR`. Callers take the min of this and the
 * requested yaw, so the guard tightens only where the camera is far enough
 * for the full swing to matter.
 */
export function budgetYaw(distance: number, budget: number): number {
  const reach = budget * ORBIT_LATERAL_FACTOR;
  if (distance <= reach) return 90;
  return Math.asin(reach / distance) / RAD;
}

/**
 * Relief depth that leans toward the cursor: `base` with the pointer centred,
 * ramping to `max` at either edge so faces turn a little as you look past
 * them. Symmetric, clamped, never below `base`.
 */
export function reliefGain(pointerX: number, base = 0.5, max = 0.8): number {
  const lean = Math.min(1, Math.abs(pointerX));
  return base + Math.max(0, max - base) * lean;
}

/**
 * Framerate-independent step for a first-order (critically-damped, no
 * overshoot) chase: the fraction of the remaining distance to close this
 * frame. `k0` is the per-frame factor the motion should feel like at `fps`,
 * so the same ground is covered per second at any frame rate.
 */
export function chase(k0: number, dt: number, fps = 60): number {
  if (k0 <= 0 || dt <= 0) return 0;
  if (k0 >= 1) return 1;
  const rate = -Math.log(1 - k0) * fps;
  return 1 - Math.exp(-rate * dt);
}
