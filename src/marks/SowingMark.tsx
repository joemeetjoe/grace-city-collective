import type { CSSProperties } from "react";

import {
  G_MARK_CORNER as CORNER,
  G_MARK_H as H,
  G_MARK_W as W,
  gMarkBox,
} from "./gMarkGeometry";
import { lozengePath } from "@/theme/lozenge";
import {
  arrives,
  departs,
  LEAVE_MS,
  parent,
  TRAVEL_MS,
} from "./sowing";
import { cn } from "@/lib/utils";

export type SowingMarkProps = {
  /** whether the reader is over the giving: the seed is handed down the rows */
  lit?: boolean;
  /**
   * whether the tiles are in place; while false they wait faded, back along
   * the diagonal, and cascade in from the seed when it turns true
   */
  shown?: boolean;
  className?: string;
};

/** the rows of the field: one seed, then two, three and four — ten tiles */
export const ROWS = 4;
export const TILES = (ROWS * (ROWS + 1)) / 2;

/** a tile's box, in the logo's units, and the gap between neighbours — wider than the calendar's, so the field reads as sown rather than stacked */
const TILE = gMarkBox(0, CORNER);
const GAP = Math.round(H * 0.35);
/** the seed's grain: a small cream lozenge, the finials' shape, in a tile's middle */
const DOT_W = Math.round(W * 0.3);
const DOT = lozengePath(0, 0, DOT_W, DOT_W / 2);

/** how far out along the diagonal a waiting tile sits, in its own heights */
const ENTER_OUT = 0.6;
export const ENTER_SCALE = 0.55;
/** the cascade: one diagonal of tiles after the next, in ms */
export const ENTER_STAGGER_MS = 50;

/** the field's extent, in the logo's units */
export const VIEW_W = ROWS * W + (ROWS - 1) * GAP;
export const VIEW_H = ROWS * H + (ROWS - 1) * GAP;

const TRANSITION =
  "motion-safe:[transition:fill-opacity_.3s_ease,stroke-opacity_.3s_ease,opacity_.9s_cubic-bezier(0.16,1,0.3,1),transform_.9s_cubic-bezier(0.16,1,0.3,1)]";

/** a tile's centre, in the logo's units: each row is centred under the seed */
function centre(row: number, col: number): { cx: number; cy: number } {
  const rowW = (row + 1) * W + row * GAP;
  return {
    cx: (VIEW_W - rowW) / 2 + col * (W + GAP) + W / 2,
    cy: row * (H + GAP) + H / 2,
  };
}

/** a tile's transform about its own centre, in the logo's units */
function pose(shown: boolean): string {
  if (!shown) {
    const out = -ENTER_OUT * H;
    return `translate(${out}px, ${out}px) scale(${ENTER_SCALE})`;
  }
  return "translate(0px, 0px) scale(1)";
}

/**
 * The giving's ornament: a field sown and reaped (2 Corinthians 9:6, the
 * passage the copy cites), drawn in the G mark's box — rounded top-left and
 * bottom-right, pointed on the other two corners — in a cream hairline, the
 * finials' weight. Ten tiles stand in a triangle: one seed at the top,
 * filled in the seal's red for what He gave, with a grain of cream in its
 * middle, over rows of two, three and four for what we give on; ten tiles,
 * one red, is also a tithe, unspoken. The tiles cascade in from the seed
 * when the panel around them is shown. While the reader is over the giving
 * the seed hands its grain down to the next row — one grain becomes two —
 * and that row fills red as they land, then hands its grains on to the
 * next, and the next, until the whole field is red and the grains rest in
 * the last row (sowing.ts for the timing; index.css for sow-travel and
 * sow-leave). The drawing fits
 * whatever box it is given, from the top.
 */
export default function SowingMark({
  lit = false,
  shown = true,
  className,
}: SowingMarkProps) {
  const tiles: Array<{ row: number; col: number }> = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col <= row; col++) tiles.push({ row, col });
  }
  return (
    <svg
      aria-hidden
      data-sowing-mark=""
      data-lit={lit ? "" : undefined}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMin meet"
      className={cn("block text-cream", className)}
    >
      {tiles.map(({ row, col }) => {
        const seed = row === 0;
        const on = seed || lit;
        const last = row === ROWS - 1;
        const { cx, cy } = centre(row, col);
        // the pose moves the tile's own group, so the path keeps its centring
        const style: CSSProperties = {
          transform: pose(shown),
          transformOrigin: "center",
          transformBox: "fill-box",
          transitionDelay: `${shown ? (row + col) * ENTER_STAGGER_MS : 0}ms`,
          opacity: shown ? 1 : 0,
        };
        // the grain sets out from its parent's centre: the first row's grains
        // wait there in the seed, visible, the others wait unseen until their
        // row's turn; the seal's fill lands with them
        let grain: CSSProperties | undefined;
        if (!seed) {
          const from = parent(row, col);
          const p = centre(from.row, from.col);
          const dx = p.cx - cx;
          const dy = p.cy - cy;
          const travel = `sow-travel ${TRAVEL_MS}ms cubic-bezier(0.16,1,0.3,1) ${departs(row)}ms forwards`;
          const leave = `sow-leave ${LEAVE_MS}ms ease ${departs(row + 1)}ms forwards`;
          grain = {
            ["--from-x" as string]: `${dx}px`,
            ["--from-y" as string]: `${dy}px`,
            transform: `translate(${dx}px, ${dy}px)`,
            opacity: row === 1 ? 1 : 0,
            animation: lit ? (last ? travel : `${travel}, ${leave}`) : "none",
          };
        }
        return (
          <g key={`${row}-${col}`} transform={`translate(${cx} ${cy})`}>
            <g
              data-tile=""
              data-seed={seed ? "" : undefined}
              data-on={on ? "" : undefined}
              className={TRANSITION}
              style={style}
            >
              <path
                transform={`translate(${-W / 2} ${-H / 2})`}
                d={TILE}
                fill="var(--color-seal)"
                fillOpacity={on ? 1 : 0}
                stroke="currentColor"
                strokeOpacity={on ? 0.9 : 0.32}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                className={TRANSITION}
                style={{
                  transitionDelay: `${lit && !seed ? arrives(row) : 0}ms`,
                }}
              />
              {grain && (
                <path
                  data-grain=""
                  d={DOT}
                  fill="currentColor"
                  style={grain}
                />
              )}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
