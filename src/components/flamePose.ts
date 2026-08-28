/**
 * The tongues of flame leaving the apostles' heads for the dove (issue #35).
 * Pure: a flame's pose is a function of its index, the ascent progress and
 * the clock, so scrolling back down descends along the same path for free.
 *
 * Units are the tick loop's world units — the plate is IW wide, IH tall,
 * centred on the origin with y up — and every pose is an absolute world
 * position for the flame's own centre (its mask centroid), not an offset:
 * the caller passes where that centre rests on its head this frame and where
 * the dove is, and moves the mesh so the centroid lands on the result.
 */

export type Vec3 = { x: number; y: number; z: number };

/** flames in the plate — the ring is laid out for this many seats */
export const FLAME_COUNT = 15;

/** section progress at which the flames begin to leave: the start of "Who we are" */
export const ASCENT_START = 1;
/** section progress by which every flame has arrived: Give reached */
export const ASCENT_END = 4;

/**
 * Scene progress (0 = hero … one per section) as ascent progress 0…1. The
 * flames sit through the whole hero and are all gathered by the time Give
 * arrives; reduced motion pins them to their heads.
 */
export function ascentProgress(sectionProgress: number, reducedMotion = false): number {
  if (reducedMotion) return 0;
  const p = (sectionProgress - ASCENT_START) / (ASCENT_END - ASCENT_START);
  return Math.min(1, Math.max(0, p));
}

/** a flame's seat sits this far in front of the dove's plane */
export const DOVE_Z_EPS = 0.05;

/**
 * The loose ring beneath the dove, relative to the dove's centre in world
 * units: seats fall on an ellipse `radius` wide, squashed vertically, hung
 * `drop` below the dove.
 */
export const RING = { radius: 3.6, drop: 1.6, squash: 0.25 };

/** the idle bob: amplitude in world units, angular speed in rad/s */
export const BOB = { amp: 0.06, omega: 1.4 };

/** a deterministic 0…1 per index — golden-ratio hashing, well spread for small counts */
const hash = (index: number, salt: number): number => {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/**
 * When a flame leaves (`start`) and when it arrives (`end`), as ascent
 * progress. Both are seeded from the index: some leave early and drift
 * lazily, some leave late and rush, and all are seated by progress 1. The
 * window sits late in the ascent: the page snaps to section tops, so the
 * Gatherings rest (progress ⅚, a frame cut to hold heads and tongues
 * together) must still catch the flock mid-flight, a few not yet lifted.
 */
export function flameTiming(index: number): { start: number; end: number } {
  const start = 0.25 + hash(index, 1) * 0.6;
  const end = start + (1 - start) * (0.45 + 0.55 * hash(index, 2));
  return { start, end };
}

const smoothstep = (x: number): number => x * x * (3 - 2 * x);

/**
 * How far along its own path a flame is, 0 on the head … 1 seated; monotone
 * in progress. Eased in hard: a tongue lifts off its head slowly (the
 * Gatherings frame is cut to show heads and tongues together), rushes the
 * middle, and settles onto its seat.
 */
export function flameFraction(index: number, progress: number): number {
  const { start, end } = flameTiming(index);
  const x = Math.min(1, Math.max(0, (progress - start) / (end - start)));
  return smoothstep(x * x);
}

/** the flame's seat on the ring, relative to the dove's centre (x across, y up) */
export function ringSeat(index: number): { x: number; y: number } {
  // golden-angle spacing spreads any count of seats evenly around the ring
  const theta = index * 2.399963 + 0.4;
  const r = RING.radius * (0.7 + 0.3 * hash(index, 3));
  return { x: r * Math.cos(theta), y: -RING.drop + r * RING.squash * Math.sin(theta) };
}

export type FlamePoseOpts = {
  /** the flame's centre at rest on its head, this frame (world) */
  rest: Vec3;
  /** the dove's centre, this frame (world) */
  dove: Vec3;
  /** bob amplitude in world units; defaults to BOB.amp, 0 stills it */
  bob?: number;
};

/**
 * Where a flame's centre is at `progress` (0 hero … 1 gathered) and time `t`
 * (seconds). A straight lerp from the head to the seat, eased per flame, so
 * the distance left to travel only ever shrinks; z runs from the parent's
 * plane to just in front of the dove's. The bob scales with the fraction, so
 * at progress 0 the pose is the rest pose exactly.
 */
export function flamePose(index: number, progress: number, t: number, opts: FlamePoseOpts): Vec3 {
  const f = flameFraction(index, progress);
  if (f === 0) return { ...opts.rest };
  const { rest, dove } = opts;
  const seat = ringSeat(index);
  const amp = (opts.bob ?? BOB.amp) * f;
  const phase = hash(index, 4) * Math.PI * 2;
  return {
    x: rest.x + (dove.x + seat.x - rest.x) * f,
    y: rest.y + (dove.y + seat.y - rest.y) * f + amp * Math.sin(t * BOB.omega + phase),
    z: rest.z + (dove.z + DOVE_Z_EPS - rest.z) * f,
  };
}
