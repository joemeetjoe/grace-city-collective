import type { CSSProperties } from "react";

import {
  G_MARK_CORNER as CORNER,
  G_MARK_H as H,
  G_MARK_W as W,
  markBox,
} from "@/marks/gMarkGeometry";
import { STATE } from "@/theme/classes";
import { cn } from "@/lib/utils";
import Tile from "./Tile";
import { AT_REST, ENTER_SCALE, TILE_TRANSITION, enterPose, pose, stagger } from "./tileGeometry";

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

/** the seats come in one after the next, round the table from the head (TILE_STAGGER_MS); lit, each draws in toward the table this far, in its own heights */
const DRAW_IN = 0.16;

/** the drawing's extent, in the logo's units */
export const VIEW_W = TABLE_W + 2 * (GAP + SEAT_W);
export const VIEW_H = TABLE_H + 2 * (GAP + SEAT_H);

const TABLE = markBox(-TABLE_W / 2, -TABLE_H / 2, TABLE_W, TABLE_H, CORNER);
const CHAIR = markBox(-SEAT_W / 2, -SEAT_H / 2, SEAT_W, SEAT_H, SEAT_CORNER);

/** a seat's place: its centre, in the logo's units, the way it faces out from the table, and its turn round it */
type Seat = { cx: number; cy: number; dx: number; dy: number; head: boolean; delay: string };

/** the seats in order round the table: the head, down the right, the foot, up the left */
function placeSeats(): Seat[] {
  const mid = VIEW_W / 2;
  const top = SEAT_H + GAP;
  const row = (i: number) => top + GAP + i * (SEAT_H + GAP) + SEAT_H / 2;
  const places: Array<Omit<Seat, "delay">> = [
    { cx: mid, cy: SEAT_H / 2, dx: 0, dy: -1, head: true },
  ];
  for (let i = 0; i < SIDE_SEATS; i++) {
    places.push({ cx: VIEW_W - SEAT_W / 2, cy: row(i), dx: 1, dy: 0, head: false });
  }
  places.push({ cx: mid, cy: VIEW_H - SEAT_H / 2, dx: 0, dy: 1, head: false });
  for (let i = SIDE_SEATS - 1; i >= 0; i--) {
    places.push({ cx: SEAT_W / 2, cy: row(i), dx: -1, dy: 0, head: false });
  }
  return places.map((seat, order) => ({ ...seat, delay: stagger(order + 1) }));
}

/** the dozen seats, placed once */
const SEAT_PLACES = placeSeats();

/** a seat's pose: waiting, back from the table; lit, drawn in toward it */
function seatPose(seat: Seat, shown: boolean, lit: boolean): string {
  if (!shown) return enterPose(seat.dx, seat.dy, SEAT_H);
  if (!lit) return AT_REST;
  const step = -DRAW_IN * SEAT_H;
  return pose(step * seat.dx, step * seat.dy, 1);
}

/** the table's own style, shown and waiting */
const TABLE_SHOWN: CSSProperties = {
  transform: "scale(1)",
  transformOrigin: "center",
  transformBox: "fill-box",
  opacity: 1,
};
const TABLE_WAITING: CSSProperties = {
  ...TABLE_SHOWN,
  transform: `scale(${ENTER_SCALE})`,
  opacity: 0,
};

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
  return (
    <svg
      aria-hidden
      viewBox={across ? `0 0 ${VIEW_H} ${VIEW_W}` : `0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      className={cn("text-cream", className, lit && STATE.lit)}
    >
      {/* on its side the whole drawing turns a quarter anticlockwise about the
          box, so the head comes to the left; the seats' own poses turn with it */}
      <g transform={across ? `translate(0 ${VIEW_W}) rotate(-90)` : undefined}>
      <g transform={`translate(${VIEW_W / 2} ${VIEW_H / 2})`}>
        <path
          d={TABLE}
          fill="var(--color-seal)"
          fillOpacity={lit ? 1 : 0}
          stroke={lit ? "var(--color-seal)" : "currentColor"}
          strokeOpacity={lit ? 1 : 0.5}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          className={cn(TILE_TRANSITION, lit && STATE.on)}
          style={shown ? TABLE_SHOWN : TABLE_WAITING}
        />
      </g>
      {SEAT_PLACES.map((seat, order) => (
        <Tile
          key={order}
          cx={seat.cx}
          cy={seat.cy}
          d={CHAIR}
          transform={seatPose(seat, shown, lit)}
          delay={seat.delay}
          shown={shown}
          fill="currentColor"
          fillOpacity={lit ? 1 : 0}
          stroke="currentColor"
          strokeOpacity={lit ? 0.9 : seat.head ? 0.5 : 0.28}
          className={lit ? STATE.on : undefined}
        />
      ))}
      </g>
    </svg>
  );
}
