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
import { AT_REST, TILE_TRANSITION, enterLift, enterPose, pose, stagger } from "./tileGeometry";

export type SharedLifeProps = {
  /**
   * whether the reader is over the who-we-are: the lines of the program
   * fade, and its slots leave their rows to huddle up the column
   */
  lit?: boolean;
  /**
   * whether the rows are in place; while false they wait faded, up from
   * their lines, and print in from the top when it turns true
   */
  shown?: boolean;
  /**
   * the rows in one column (the desktop's tall divider column) or two side
   * by side, six and six, for a phone card where a dozen rows run too long;
   * in two columns the huddle gathers in the middle between them
   */
  columns?: Columns;
  className?: string;
};

export type Columns = 1 | 2;

/** the lines of the program, a house church's dozen */
export const ROWS = 12;

/** a slot: the G mark's box, at this scale of the mark — the table's seats' size */
const SLOT = 0.45;
const SLOT_W = Math.round(W * SLOT);
const SLOT_H = Math.round(H * SLOT);
const SLOT_CORNER = Math.round(CORNER * SLOT);
/** the gap between rows, and between a slot and its line */
const GAP = Math.round(H * 0.2);
/** the lines' longest run, in the mark's width, and how they shorten and lengthen down the page like words */
const LINE_W = Math.round(W * 2.2);
const LINE_RUNS = [
  1, 0.72, 0.88, 0.6, 0.94, 0.68, 0.8, 1, 0.64, 0.86, 0.74, 0.56,
];

/** the rows print in one after the next from the top (TILE_STAGGER_MS), each from ENTER_OUT of a slot up */

/** a slot grows this much leaving its row: a line item is smaller than a person */
export const HUDDLE_SCALE = 1.6;
/** the huddle's rings round the middle, in a grown slot's heights: close enough that every slot overlaps the ring within */
const INNER_RING = 0.7;
const OUTER_RING = 1.35;
/** where the huddle gathers, down the column: up in the top third, beside the headline and clear of the figures that cross the panel's foot */
const HUDDLE_Y = 0.3;
/** a little unevenness in the ring, so the huddle reads as a crowd and not a pattern */
const JITTER = 0.09;

/** the drawing's extent in one column, in the logo's units */
export const VIEW_W = SLOT_W + GAP + LINE_W;
export const VIEW_H = ROWS * SLOT_H + (ROWS - 1) * GAP;
/** the gap between two columns, in the mark's width */
const COLUMN_GAP = Math.round(W * 0.9);
/** the drawing's extent in two columns: six rows down each, side by side */
export const VIEW_W_2 = 2 * VIEW_W + COLUMN_GAP;
export const VIEW_H_2 = (ROWS / 2) * SLOT_H + (ROWS / 2 - 1) * GAP;

const BOX = markBox(-SLOT_W / 2, -SLOT_H / 2, SLOT_W, SLOT_H, SLOT_CORNER);

/** a line's inline style in each of its states: in place beside its slot, faded while the slots huddle, and waiting up from its place */
type LineStyles = { at: CSSProperties; faded: CSSProperties; waiting: CSSProperties };

/** a row: its slot's centre at rest, its line's run, its pose in the huddle, and its turn in the stagger */
type Row = {
  cx: number;
  cy: number;
  x1: number;
  x2: number;
  huddle: string;
  delay: string;
  heart: boolean;
  line: LineStyles;
};

type Layout = { viewW: number; viewH: number; rows: Row[] };

/** the waiting pose every slot shares: up from its line, and small */
const WAITING = enterPose(0, -1, SLOT_H);

/** the drawing laid out in a number of columns: its extent, and every row's places */
function layout(columns: Columns): Layout {
  const perColumn = ROWS / columns;
  const viewW = columns * VIEW_W + (columns - 1) * COLUMN_GAP;
  const viewH = perColumn * SLOT_H + (perColumn - 1) * GAP;
  // one column: up in the top third; two: in the middle, between the columns
  const mid = { cx: viewW / 2, cy: Math.round(viewH * (columns === 1 ? HUDDLE_Y : 0.5)) };
  const rows = Array.from({ length: ROWS }, (_, row): Row => {
    // at rest, down the first column, then the next
    const column = Math.floor(row / perColumn);
    const r = row % perColumn;
    const cx = column * (VIEW_W + COLUMN_GAP) + SLOT_W / 2;
    const cy = r * (SLOT_H + GAP) + SLOT_H / 2;
    // in the huddle: the first row's in the middle, the next five in a ring
    // round it, the last six in a ring round those, each nudged a little
    const to = huddleCentre(row, mid);
    const delay = stagger(row + 1);
    const x1 = cx + SLOT_W / 2 + GAP;
    const lift = `translateY(${enterLift(SLOT_H)}px)`;
    return {
      cx,
      cy,
      x1,
      x2: x1 + LINE_W * LINE_RUNS[row],
      huddle: pose(to.cx - cx, to.cy - cy, HUDDLE_SCALE),
      delay,
      heart: row === 0,
      line: {
        at: { opacity: 1, transform: "translateY(0px)", transitionDelay: delay },
        faded: { opacity: 0, transform: "translateY(0px)", transitionDelay: delay },
        waiting: { opacity: 0, transform: lift, transitionDelay: delay },
      },
    };
  });
  return { viewW, viewH, rows };
}

function huddleCentre(row: number, mid: { cx: number; cy: number }): { cx: number; cy: number } {
  if (row === 0) return mid;
  const inner = row <= 5;
  const n = inner ? 5 : 6;
  const i = inner ? row - 1 : row - 6;
  const ring = (inner ? INNER_RING : OUTER_RING) * SLOT_H * HUDDLE_SCALE;
  const angle = (i / n) * 2 * Math.PI - Math.PI / 2 + (inner ? 0 : Math.PI / n);
  const jitter = JITTER * SLOT_H * HUDDLE_SCALE * (i % 2 === 0 ? 1 : -1);
  return {
    cx: Math.round(mid.cx + ring * Math.cos(angle) + jitter),
    cy: Math.round(mid.cy + ring * Math.sin(angle) - jitter / 2),
  };
}

/** both layouts, placed once */
const LAYOUTS: Record<Columns, Layout> = { 1: layout(1), 2: layout(2) };

/** the slots in drawing order: the heart is drawn last, so its red sits over the cream of the rest */
const DRAW_ORDER = [...Array.from({ length: ROWS - 1 }, (_, i) => i + 1), 0];

/**
 * A life shared, not a program, drawn in the G mark's box — rounded
 * top-left and bottom-right, pointed on the other two corners — in a cream
 * hairline, the finials' weight. At rest it is an order of service: a
 * dozen rows down a tall column, each a slot of the mark's box with a
 * hairline running from it for its line, the lines long and short down
 * the page the way words are. The rows print in from the top when the
 * panel around them is shown. While the reader is over the who-we-are the
 * lines fade out and the slots leave their rows, growing as they go, to
 * huddle in the top third of the column close enough to overlap: each fills
 * a faint cream, so
 * where lives overlap the fill compounds and the huddle is brightest at
 * its heart, where the first row's slot fills the seal's red. The drawing
 * sits centred in whatever box it is given.
 */
export default function SharedLife({
  lit = false,
  shown = true,
  columns = 1,
  className,
}: SharedLifeProps) {
  const { viewW, viewH, rows } = LAYOUTS[columns];
  const slotPose = !shown ? WAITING : !lit ? AT_REST : undefined;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${viewW} ${viewH}`}
      preserveAspectRatio="xMidYMid meet"
      className={cn("text-cream", className, lit && STATE.lit)}
    >
      {rows.map((row, i) => (
        <line
          key={i}
          x1={row.x1}
          x2={row.x2}
          y1={row.cy}
          y2={row.cy}
          stroke="currentColor"
          strokeOpacity={0.3}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
          className={TILE_TRANSITION}
          style={!shown ? row.line.waiting : lit ? row.line.faded : row.line.at}
        />
      ))}
      {DRAW_ORDER.map((i) => {
        const row = rows[i];
        return (
          <Tile
            key={i}
            cx={row.cx}
            cy={row.cy}
            d={BOX}
            transform={slotPose ?? row.huddle}
            delay={row.delay}
            shown={shown}
            fill={row.heart ? "var(--color-seal)" : "currentColor"}
            fillOpacity={lit ? (row.heart ? 1 : 0.2) : 0}
            stroke={row.heart && lit ? "var(--color-seal)" : "currentColor"}
            strokeOpacity={lit ? 0.7 : row.heart ? 0.5 : 0.28}
            className={lit ? STATE.on : undefined}
          />
        );
      })}
    </svg>
  );
}
