/**
 * Pure maths for the portrait frame in PentecostParallax.
 *
 * Each waypoint declares the vertical BAND of the plate its frame must contain,
 * and the camera distance is solved so that band fills the frame vertically at
 * any aspect. On a portrait frame that same band shows only a narrow slice of
 * the plate's width — at 390×844 (aspect 0.46) about a third of it, two faces
 * where the landscape frame shows a gathering. So a portrait frame widens
 * every band about its centre by one factor before solving; the solve's own
 * clamp to the cover-fit caps it. A landscape frame passes the factor as 1,
 * so the desktop framing cannot move.
 */

export type Band = [number, number];

/**
 * How much taller every waypoint's band gets on a portrait frame. Tuned by eye
 * at 390×844: at 1.35 the hero still cropped to a handful of hoods; at 1.5
 * the ring of apostles reads as a gathering with the floor under it, the
 * flames sit just below the headline's foot, and the dove stop keeps the
 * dove over its copy. The hero's band (0.58 tall) becomes 0.87, still under
 * the 0.95 cover-fit the solve clamps to, so nothing hits the cap.
 */
export const PORTRAIT_BAND_FACTOR = 1.5;

/** the factor a frame of `aspect` (width / height) widens its bands by */
export function portraitFactor(aspect: number, factor = PORTRAIT_BAND_FACTOR): number {
  return aspect < 1 ? factor : 1;
}

/**
 * `band` scaled about its centre by `factor`. The centre is kept exactly, so
 * the frame's aim point is untouched; only the solved distance moves.
 */
export function widenBand(band: Band, factor: number): Band {
  if (factor === 1) return band;
  const mid = (band[0] + band[1]) / 2;
  const half = ((band[1] - band[0]) / 2) * factor;
  return [mid - half, mid + half];
}
