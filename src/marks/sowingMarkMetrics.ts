import { G_MARK_H as H, G_MARK_W as W } from "./gMarkGeometry";

/**
 * The sown field's measures (SowingMark.tsx; the artwork itself is
 * sowingMarkPaths.ts), in the logo's units.
 */

/** the rows of the field: one seed, then two, three and four — ten tiles */
export const SOW_ROWS = 4;
export const TILES = (SOW_ROWS * (SOW_ROWS + 1)) / 2;

/** the gap between neighbouring tiles — wider than the calendar's, so the field reads as sown rather than stacked */
const GAP = Math.round(H * 0.35);

/** how far out along the diagonal a waiting tile sits, in its own heights */
export const SOW_ENTER_OUT = 0.6;
export const SOW_ENTER_SCALE = 0.55;

/** the field's extent */
export const SOW_VIEW_W = SOW_ROWS * W + (SOW_ROWS - 1) * GAP;
export const SOW_VIEW_H = SOW_ROWS * H + (SOW_ROWS - 1) * GAP;

/** a tile's centre: each row is centred under the seed */
export function centre(row: number, col: number): { cx: number; cy: number } {
  const rowW = (row + 1) * W + row * GAP;
  return {
    cx: (SOW_VIEW_W - rowW) / 2 + col * (W + GAP) + W / 2,
    cy: row * (H + GAP) + H / 2,
  };
}
