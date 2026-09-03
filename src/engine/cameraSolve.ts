import { portraitFactor, widenBand } from "./portraitBand";
import { CAMERA, DOVE_V, FRAME, LATERAL_MAX, PLATE } from "./tuning";
import { WAYPOINTS, waypointSpan, type Waypoint } from "./waypoints";

/**
 * The scroll-driven camera as pure arithmetic (#120): where the frame wants
 * to be for a section progress, before the chase and the pointer's orbit
 * (cameraOrbit.ts) act on it. Nothing here touches three.js — the tick
 * feeds it numbers and the factory applies the result.
 */

export type Frame = { x: number; y: number; z: number };

/** the plate's world size: PLATE unless a test says otherwise */
export type PlateSize = { w: number; h: number };

/** tan of the camera's half field of view */
export function halfTan(fovDeg: number = CAMERA.fov): number {
  return Math.tan(((fovDeg * Math.PI) / 180) / 2);
}

/**
 * The registration distance (baseZ): the camera distance at which the plate
 * cover-fits the frame — against the image extent, not the deliberately
 * larger planes — at `cover` of the frame.
 */
export function registrationDistance(aspect: number, plate: PlateSize = PLATE, camera = CAMERA): number {
  const tan = halfTan(camera.fov);
  return camera.cover * Math.min(plate.h / 2 / tan, plate.w / 2 / (tan * aspect));
}

export type SolveContext = {
  /** the registration distance for the live aspect */
  baseZ: number;
  /** the frame's aspect */
  aspect: number;
  /** the dove plane's live z, when the tier's set has a dove; undefined aims at the band instead */
  doveZ?: number;
  plate?: PlateSize;
  fovDeg?: number;
};

/**
 * The frame that makes a waypoint's band fill the frame vertically — note
 * the distance never involves aspect, which is the whole point. A portrait
 * frame widens every band about its centre (portraitBand.ts) so the phone
 * sees a gathering, not a slice two faces wide; a landscape frame passes 1,
 * so the desktop framing cannot move.
 */
export function solveWaypoint(wp: Waypoint, ctx: SolveContext): Frame {
  const plate = ctx.plate ?? PLATE;
  const tanA = halfTan(ctx.fovDeg);
  const pf = portraitFactor(ctx.aspect);
  // the dove stop keeps its authored band on a portrait frame: it already
  // starts above the plate's top edge, and widened it would look a quarter
  // of the frame past the plate — clamped rows streaking down from the top.
  // Every other stop widens.
  const band = widenBand(wp.band, wp.aim === "dove" ? 1 : pf);
  const z = Math.max(ctx.baseZ * FRAME.zMin, Math.min(ctx.baseZ, ((band[1] - band[0]) / 2) * plate.h / tanA));
  const hh = z * tanA;
  let y: number;
  if (wp.aim === "dove" && ctx.doveZ !== undefined) {
    // a far layer's apparent height is not the plate's, so the dove has to
    // be solved against where its own plane actually is
    const zL = ctx.doveZ;
    const yL = (0.5 - DOVE_V) * plate.h * ((ctx.baseZ - zL) / ctx.baseZ);
    const at = pf > 1 && wp.atPortrait !== undefined ? wp.atPortrait : (wp.at ?? 0.6);
    y = yL - (2 * at - 1) * hh / (z / (z - zL));
  } else {
    y = (0.5 - (band[0] + band[1]) / 2) * plate.h;
  }
  return { y, z, x: (wp.u ?? 0) * plate.w };
}

export type CameraSolveInput = SolveContext & {
  /** section progress, clamped to the scene's last section */
  sp: number;
  /** the idle drift's offset this frame (0 when idle drift is off) */
  drift?: { x: number; y: number };
  waypoints?: readonly Waypoint[];
};

export type CameraSolve = {
  /** where the chase is headed: the interpolated frame, clamped to the limits */
  target: Frame;
  /** the frame centre's confinement, for the orbit's slide too */
  limit: { x: number; y: number };
};

/**
 * The frame the camera wants at `sp`: the two waypoints around it solved,
 * interpolated along the hold-then-travel ease, the idle drift added, and the
 * centre clamped so the frame stays over the plate (y) and within the
 * lateral budget (x).
 */
export function solveCamera(input: CameraSolveInput): CameraSolve {
  const plate = input.plate ?? PLATE;
  const waypoints = input.waypoints ?? WAYPOINTS;
  const tanA = halfTan(input.fovDeg);
  const span = waypointSpan(input.sp, waypoints.length);
  const wa = solveWaypoint(waypoints[span.from], input);
  const wb = solveWaypoint(waypoints[span.to], input);
  const z = wa.z + (wb.z - wa.z) * span.t;
  const halfH = z * tanA;
  const limY = Math.max(0, plate.h * FRAME.yReach - halfH);
  const limX = Math.min(Math.max(0, plate.w / 2 - halfH * input.aspect), plate.w * LATERAL_MAX);
  const drift = input.drift ?? { x: 0, y: 0 };
  const xWant = wa.x + (wb.x - wa.x) * span.t + drift.x;
  const yWant = wa.y + (wb.y - wa.y) * span.t + drift.y;
  return {
    target: { x: Math.max(-limX, Math.min(limX, xWant)), y: Math.max(-limY, Math.min(limY, yWant)), z },
    limit: { x: limX, y: limY },
  };
}
