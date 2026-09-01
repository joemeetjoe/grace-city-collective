/**
 * Dynamic pixel ratio for the scroll (#70). Motion hides resolution: while
 * the smoothed scroll is flying, both canvases render at a reduced ratio,
 * and the frame that settles renders at the tier's full cap, so the resting
 * image is always sharp. Keyed to scroll speed alone — pointer parallax is
 * subtle motion over a mostly-still frame, where the softness would show.
 * Hysteresis between the thresholds keeps the buffers from thrashing.
 */

export const SCROLL_DPR = {
  /** smoothed scroll speed that drops the ratio, CSS px/s — a flick or a snap */
  enterPxPerS: 900,
  /** and the speed under which the frame lands sharp again */
  exitPxPerS: 150,
  /** the moving ratio, as a fraction of the sharp cap */
  scale: 0.7,
} as const;

/** the reduced ratio for a tier's sharp cap; never below 1 */
export function movingDprFor(sharp: number): number {
  return Math.max(1, sharp * SCROLL_DPR.scale);
}

export type ScrollDprConfig = {
  sharp: number;
  moving: number;
  enterPxPerS: number;
  exitPxPerS: number;
};

export function createScrollDpr(cfg: ScrollDprConfig) {
  let current = cfg.sharp;
  return {
    /** the ratio to render this frame at, for the smoothed scroll's |speed| */
    forSpeed(pxPerS: number): number {
      if (pxPerS >= cfg.enterPxPerS) current = cfg.moving;
      else if (pxPerS <= cfg.exitPxPerS) current = cfg.sharp;
      return current;
    },
  };
}
