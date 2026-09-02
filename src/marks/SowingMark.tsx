import { memo, type CSSProperties, type Ref } from "react";

import { G_MARK_H as H, G_MARK_W as W } from "./gMarkGeometry";
import { cssVars } from "@/theme/cssVars";
import { EASE_SITE, SOW_LEAVE_MS, SOW_TRAVEL_MS, TILE_STAGGER_MS } from "@/theme/motion";
import { arrives, departs } from "./sowing";
import { ENTER_OUT, ENTER_SCALE, ROWS, VIEW_H, VIEW_W } from "./sowingMarkMetrics";
import { DOT, TILE, TILE_LAYOUT } from "./sowingMarkPaths";
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
  ref?: Ref<SVGSVGElement>;
};

const VIEWBOX = `0 0 ${VIEW_W} ${VIEW_H}`;

/** the cascade: one diagonal of tiles after the next (TILE_STAGGER_MS) */
const TRANSITION =
  "motion-safe:[transition:fill-opacity_.3s_ease,stroke-opacity_.3s_ease,opacity_.9s_var(--ease-site),transform_.9s_var(--ease-site)]";

/** a tile's transform about its own centre, in the logo's units: in place, or waiting out along the diagonal */
const POSE_HOME = "translate(0px, 0px) scale(1)";
const POSE_WAITING = `translate(${-ENTER_OUT * H}px, ${-ENTER_OUT * H}px) scale(${ENTER_SCALE})`;

/** a tile's path is drawn about the group's origin */
const TILE_TRANSFORM = `translate(${-W / 2} ${-H / 2})`;

/** the hand-off, by row: a grain travels down (sow-travel) and, unless the row is the last, leaves once its row has handed on (sow-leave); index.css */
const HANDOFF: readonly string[] = Array.from({ length: ROWS }, (_, row) => {
  const travel = `sow-travel ${SOW_TRAVEL_MS}ms ${EASE_SITE} ${departs(row)}ms forwards`;
  const leave = `sow-leave ${SOW_LEAVE_MS}ms ease ${departs(row + 1)}ms forwards`;
  return row === ROWS - 1 ? travel : `${travel}, ${leave}`;
});

/**
 * A grain's resting style, settled once per tile: it waits at its parent's
 * centre (--from-x/--from-y, where sow-travel sets out from), the first
 * row's visible in the seed, the others unseen until their row's turn.
 */
const GRAIN_REST: ReadonlyArray<CSSProperties | undefined> = TILE_LAYOUT.map(({ row, from }) =>
  from
    ? cssVars({
        "--from-x": `${from.dx}px`,
        "--from-y": `${from.dy}px`,
        transform: `translate(${from.dx}px, ${from.dy}px)`,
        opacity: row === 1 ? 1 : 0,
      })
    : undefined,
);

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
 * sow-leave). The field itself is sowingMarkPaths.ts. The drawing fits
 * whatever box it is given, from the top.
 */
function SowingMark({ lit = false, shown = true, className, ref }: SowingMarkProps) {
  return (
    <svg
      aria-hidden
      data-sowing-mark=""
      data-lit={lit ? "" : undefined}
      viewBox={VIEWBOX}
      preserveAspectRatio="xMidYMin meet"
      className={cn("block text-cream", className)}
      ref={ref}
    >
      {TILE_LAYOUT.map(({ row, col, cx, cy }, i) => {
        const seed = row === 0;
        const on = seed || lit;
        // the pose moves the tile's own group, so the path keeps its centring
        const style: CSSProperties = {
          transform: shown ? POSE_HOME : POSE_WAITING,
          transformOrigin: "center",
          transformBox: "fill-box",
          transitionDelay: `${shown ? (row + col) * TILE_STAGGER_MS : 0}ms`,
          opacity: shown ? 1 : 0,
        };
        // the seal's fill lands with the grains
        const rest = GRAIN_REST[i];
        const grain = rest && { ...rest, animation: lit ? HANDOFF[row] : "none" };
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
                transform={TILE_TRANSFORM}
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
              {grain && <path data-grain="" d={DOT} fill="currentColor" style={grain} />}
            </g>
          </g>
        );
      })}
    </svg>
  );
}

export default memo(SowingMark);
