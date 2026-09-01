import type { CSSProperties } from "react";

import {
  G_MARK_CORNER as CORNER,
  G_MARK_H as H,
  G_MARK_W as W,
  markBox,
} from "@/marks/gMarkGeometry";
import { cn } from "@/lib/utils";

export type HouseTableProps = {
  /** whether the reader is over the house churches: the seats draw in and fill, and the table fills */
  lit?: boolean;
  /**
   * whether the seats are taken; while false they wait faded, back from the
   * table, and come in one after the next round the table when it turns true
   */
  shown?: boolean;
  /**
   * the table on its side: the long axis across the box, the head at the
   * left — for a phone card, where the words run above it and a tall column
   * would push everything down
   */
  across?: boolean;
  className?: string;
};

/** seats down each long side of the table; with the head and the foot, a house church's dozen */
export const SIDE_SEATS = 5;
export const SEATS = SIDE_SEATS * 2 + 2;

/** a seat: the G mark's box, at this scale of the mark */
const SEAT = 0.45;
const SEAT_W = Math.round(W * SEAT);
const SEAT_H = Math.round(H * SEAT);
const SEAT_CORNER = Math.round(CORNER * SEAT);
/** the gap between a seat and the table, and between neighbours down a side */
const GAP = Math.round(H * 0.2);
/** the table: the mark's box drawn long, with the mark's own corners, sized to seat a side */
const TABLE_W = W;
const TABLE_H = SIDE_SEATS * SEAT_H + (SIDE_SEATS + 1) * GAP;

/** how far back from the table a waiting seat sits, in its own heights */
const ENTER_OUT = 0.6;
export const ENTER_SCALE = 0.55;
/** the seats come in one after the next, round the table from the head, in ms */
export const ENTER_STAGGER_MS = 50;
/** how far a seat draws in toward the table when lit, in its own heights */
const DRAW_IN = 0.16;

/** the drawing's extent, in the logo's units */
export const VIEW_W = TABLE_W + 2 * (GAP + SEAT_W);
export const VIEW_H = TABLE_H + 2 * (GAP + SEAT_H);

const TRANSITION =
  "motion-safe:[transition:fill_.5s_ease,fill-opacity_.5s_ease,stroke_.5s_ease,stroke-opacity_.5s_ease,opacity_.9s_cubic-bezier(0.16,1,0.3,1),transform_.9s_cubic-bezier(0.16,1,0.3,1)]";

const TABLE = markBox(-TABLE_W / 2, -TABLE_H / 2, TABLE_W, TABLE_H, CORNER);
const CHAIR = markBox(-SEAT_W / 2, -SEAT_H / 2, SEAT_W, SEAT_H, SEAT_CORNER);

/** a seat's place: its centre, in the logo's units, and the way it faces out from the table */
type Seat = { cx: number; cy: number; dx: number; dy: number; name: string };

/** the seats in order round the table: the head, down the right, the foot, up the left */
function seats(): Seat[] {
  const mid = VIEW_W / 2;
  const top = SEAT_H + GAP;
  const row = (i: number) => top + GAP + i * (SEAT_H + GAP) + SEAT_H / 2;
  const out: Seat[] = [
    { cx: mid, cy: SEAT_H / 2, dx: 0, dy: -1, name: "head" },
  ];
  for (let i = 0; i < SIDE_SEATS; i++) {
    out.push({
      cx: VIEW_W - SEAT_W / 2,
      cy: row(i),
      dx: 1,
      dy: 0,
      name: `right-${i}`,
    });
  }
  out.push({ cx: mid, cy: VIEW_H - SEAT_H / 2, dx: 0, dy: 1, name: "foot" });
  for (let i = SIDE_SEATS - 1; i >= 0; i--) {
    out.push({ cx: SEAT_W / 2, cy: row(i), dx: -1, dy: 0, name: `left-${i}` });
  }
  return out;
}

/** a seat's transform about its own centre, in the logo's units */
function pose(seat: Seat, shown: boolean, lit: boolean): string {
  if (!shown) {
    const out = ENTER_OUT * SEAT_H;
    return `translate(${out * seat.dx}px, ${out * seat.dy}px) scale(${ENTER_SCALE})`;
  }
  const step = lit ? -DRAW_IN * SEAT_H : 0;
  return `translate(${step * seat.dx}px, ${step * seat.dy}px) scale(1)`;
}

/**
 * A house church at table, drawn in the G mark's box — rounded top-left and
 * bottom-right, pointed on the other two corners — in a cream hairline, the
 * finials' weight: the mark's box drawn long for the table, standing on end
 * to fill a tall column, and a dozen of the same box small for the seats
 * round it, five down each side and one at the head and the foot. The
 * head's seat sits a little brighter, the elder's. The seats come in one
 * after the next round the table from the head when the panel around them
 * is shown, each sliding up from a little way back; while the reader is
 * over the house churches the seats draw in to the table and fill cream,
 * and the table fills the seal's red. The drawing sits centred in
 * whatever box it is given.
 */
export default function HouseTable({
  lit = false,
  shown = true,
  across = false,
  className,
}: HouseTableProps) {
  const table: CSSProperties = {
    transform: shown ? "scale(1)" : `scale(${ENTER_SCALE})`,
    transformOrigin: "center",
    transformBox: "fill-box",
    opacity: shown ? 1 : 0,
  };
  return (
    <svg
      aria-hidden
      data-house-table=""
      data-lit={lit ? "" : undefined}
      data-across={across ? "" : undefined}
      viewBox={across ? `0 0 ${VIEW_H} ${VIEW_W}` : `0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      className={cn("block text-cream", className)}
    >
      {/* on its side the whole drawing turns a quarter anticlockwise about the
          box, so the head comes to the left; the seats' own poses turn with it */}
      <g transform={across ? `translate(0 ${VIEW_W}) rotate(-90)` : undefined}>
      <g transform={`translate(${VIEW_W / 2} ${VIEW_H / 2})`}>
        <path
          data-table=""
          data-on={lit ? "" : undefined}
          d={TABLE}
          fill="var(--color-seal)"
          fillOpacity={lit ? 1 : 0}
          stroke={lit ? "var(--color-seal)" : "currentColor"}
          strokeOpacity={lit ? 1 : 0.5}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          className={TRANSITION}
          style={table}
        />
      </g>
      {seats().map((seat, order) => {
        const head = seat.name === "head";
        const delay = `${(order + 1) * ENTER_STAGGER_MS}ms`;
        // the pose moves the seat's own group, so the path keeps its centring
        const style: CSSProperties = {
          transform: pose(seat, shown, lit),
          transformOrigin: "center",
          transformBox: "fill-box",
          transitionDelay: delay,
          opacity: shown ? 1 : 0,
        };
        return (
          <g key={seat.name} transform={`translate(${seat.cx} ${seat.cy})`}>
            <g
              data-seat={seat.name}
              data-on={lit ? "" : undefined}
              className={TRANSITION}
              style={style}
            >
              <path
                d={CHAIR}
                fill="currentColor"
                fillOpacity={lit ? 1 : 0}
                stroke="currentColor"
                strokeOpacity={lit ? 0.9 : head ? 0.5 : 0.28}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                className={TRANSITION}
                style={{ transitionDelay: delay }}
              />
            </g>
          </g>
        );
      })}
      </g>
    </svg>
  );
}
