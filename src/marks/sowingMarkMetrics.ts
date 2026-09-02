import { G_MARK_H as H, G_MARK_W as W } from "./gMarkGeometry";

/**
 * The sown field's measures (SowingMark.tsx; the artwork itself is
 * sowingMarkPaths.ts), in the logo's units.
 */

/** the rows of the field: one seed, then two, three and four — ten tiles */
export const ROWS = 4;
export const TILES = (ROWS * (ROWS + 1)) / 2;

/** the gap between neighbouring tiles — wider than the calendar's, so the field reads as sown rather than stacked */
export const GAP = Math.round(H * 0.35);

/** how far out along the diagonal a waiting tile sits, in its own heights */
export const ENTER_OUT = 0.6;
export const ENTER_SCALE = 0.55;

/** the field's extent */
export const VIEW_W = ROWS * W + (ROWS - 1) * GAP;
export const VIEW_H = ROWS * H + (ROWS - 1) * GAP;

/** a tile's centre: each row is centred under the seed */
export function centre(row: number, col: number): { cx: number; cy: number } {
  const rowW = (row + 1) * W + row * GAP;
  return {
    cx: (VIEW_W - rowW) / 2 + col * (W + GAP) + W / 2,
    cy: row * (H + GAP) + H / 2,
  };
}
