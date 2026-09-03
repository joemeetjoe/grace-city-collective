import { HOLD } from "./tuning";

export type Waypoint = {
  /** band of the plate this frame must contain, in image v (0 = top) */
  band: [number, number];
  /** lateral offset as a fraction of plate width */
  u?: number;
  /** aim at a named layer's live position instead of the band centre */
  aim?: "dove";
  /** where in frame the aimed layer should sit (0 = bottom, 1 = top) */
  at?: number;
  /**
   * the same on a portrait frame, where the copy sits at the foot: the dove
   * goes near the top, above the panel. The dove's plane is far nearer the
   * camera than the plate (zL ≈ −4.8 against a distance of ≈ 6.3), so the
   * camera must climb about twice as far as the dove appears to move, and a
   * low value leaves the frame looking well above the plate's top edge — at
   * 0.82 the frame's top cleared it by 16% of the frame, all of it smear.
   * 0.88 leaves 5.5%, and the backdrop runs out into the ink over that (FRAG)
   * rather than streaking. Higher still would tuck the dove under the seal row.
   */
  atPortrait?: number;
};

/**
 * One waypoint per section. Each declares the BAND of the plate it must contain
 * rather than a frame centre — the frame's half-height in image units is
 * aspect-dependent, so a centre tuned at 4:3 starves on 16:9. Solving the
 * distance from the band fills the frame identically at every aspect.
 *
 * Content sits at: flames v 0.26–0.42, faces v 0.42–0.52, robes down to v 0.78,
 * the dove at v 0.033. The band between v 0.25 and v 0.10 is bare wall — never
 * aim a waypoint there.
 */
export const WAYPOINTS: readonly Waypoint[] = [
  { band: [0.185, 0.765], u: 0.03 }, // hero — the gathering under its flames; the near hoods reach the headline's foot
  { band: [0.30, 0.74], u: -0.05 }, // who we are — a step toward the left of the ring
  { band: [0.30, 0.58], u: 0.0 },   // house churches — centre, under the beam
  { band: [0.28, 0.64], u: 0.05 },  // gatherings — heads and tongues of flame
  { band: [0.36, 0.66], u: -0.03 }, // give — close on the faces, robes below
  { band: [-0.02, 0.20], u: 0.0, aim: "dove", at: 0.7, atPortrait: 0.88 }, // visit — the dove, with the copy under it
];

/** Hermite ease, 0..1 → 0..1 */
export function smoothstep01(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
}

export type WaypointSpan = {
  /** the waypoint held through the section's first half */
  from: number;
  /** the one travelled to through its second */
  to: number;
  /** the eased travel, 0 at the hold and 1 on arrival */
  t: number;
};

/**
 * Which two waypoints frame section progress `sp`, and how far along the
 * travel between them: hold each section's own frame through the first
 * `hold` of it, then ease to the next — otherwise a section spends its
 * whole length en route to the NEXT waypoint. Past the table both indices
 * clamp to the last waypoint.
 */
export function waypointSpan(sp: number, count: number = WAYPOINTS.length, hold: number = HOLD): WaypointSpan {
  const last = count - 1;
  const from = Math.min(last, Math.floor(sp));
  const to = Math.min(last, from + 1);
  const ft = sp - from;
  const t = smoothstep01((ft - hold) / (1 - hold));
  return { from, to, t };
}
