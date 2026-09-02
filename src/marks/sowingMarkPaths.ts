import { G_MARK_CORNER as CORNER, G_MARK_W as W, gMarkBox } from "./gMarkGeometry";
import { lozengePath } from "@/theme/lozenge";
import { parent } from "./sowing";
import { ROWS, centre } from "./sowingMarkMetrics";

/**
 * The sown field's artwork (SowingMark.tsx), settled once: a tile's box,
 * the seed's grain, and where every tile stands.
 */

/** a tile's box, in the logo's units: the G mark's, rounded top-left and bottom-right */
export const TILE = gMarkBox(0, CORNER);

/** the seed's grain: a small cream lozenge, the finials' shape, in a tile's middle */
const DOT_W = Math.round(W * 0.3);
export const DOT = lozengePath(0, 0, DOT_W, DOT_W / 2);

export type Tile = {
  /** names the tile in the field: its React key */
  id: string;
  row: number;
  col: number;
  /** its centre, in the logo's units */
  cx: number;
  cy: number;
  /** its parent's centre relative to its own, where its grain sets out from; the seed has no parent */
  from?: { dx: number; dy: number };
};

/** the ten tiles, a row at a time, each row left to right */
export const TILE_LAYOUT: readonly Tile[] = (() => {
  const tiles: Tile[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col <= row; col++) {
      const { cx, cy } = centre(row, col);
      const tile: Tile = { id: `r${row}c${col}`, row, col, cx, cy };
      if (row > 0) {
        const p = parent(row, col);
        const at = centre(p.row, p.col);
        tile.from = { dx: at.cx - cx, dy: at.cy - cy };
      }
      tiles.push(tile);
    }
  }
  return tiles;
})();
