import type { CSSProperties } from "react";

import {
  G_MARK_CORNER as CORNER,
  G_MARK_H as H,
  G_MARK_W as W,
  markBox,
} from "@/components/gMarkGeometry";
import { cn } from "@/lib/utils";

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
  className?: string;
};

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

/** how far up from its line a waiting row sits, in a slot's heights */
const ENTER_OUT = 0.6;
export const ENTER_SCALE = 0.55;
/** the rows print in one after the next from the top, in ms */
export const ENTER_STAGGER_MS = 50;

/** a slot grows this much leaving its row: a line item is smaller than a person */
export const HUDDLE_SCALE = 1.6;
/** the huddle's rings round the middle, in a grown slot's heights: close enough that every slot overlaps the ring within */
const INNER_RING = 0.7;
const OUTER_RING = 1.35;
/** where the huddle gathers, down the column: up in the top third, beside the headline and clear of the figures that cross the panel's foot */
const HUDDLE_Y = 0.3;
/** a little unevenness in the ring, so the huddle reads as a crowd and not a pattern */
const JITTER = 0.09;

/** the drawing's extent, in the logo's units */
export const VIEW_W = SLOT_W + GAP + LINE_W;
export const VIEW_H = ROWS * SLOT_H + (ROWS - 1) * GAP;

const TRANSITION =
  "motion-safe:[transition:fill_.5s_ease,fill-opacity_.5s_ease,stroke_.5s_ease,stroke-opacity_.5s_ease,opacity_.9s_cubic-bezier(0.16,1,0.3,1),transform_.9s_cubic-bezier(0.16,1,0.3,1)]";

const BOX = markBox(-SLOT_W / 2, -SLOT_H / 2, SLOT_W, SLOT_H, SLOT_CORNER);

/** a row's slot at rest: its centre, in the logo's units */
function restCentre(row: number): { cx: number; cy: number } {
  return { cx: SLOT_W / 2, cy: row * (SLOT_H + GAP) + SLOT_H / 2 };
}

/**
 * where a slot stands in the huddle, in the logo's units: the first row's
 * in the middle, the next five in a ring round it, the last six in a ring
 * round those, each nudged a little off its place
 */
function huddleCentre(row: number): { cx: number; cy: number } {
  const mid = { cx: VIEW_W / 2, cy: Math.round(VIEW_H * HUDDLE_Y) };
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

/** a slot's transform about its own centre, in the logo's units */
function pose(row: number, shown: boolean, lit: boolean): string {
  if (!shown) {
    return `translate(0px, ${-ENTER_OUT * SLOT_H}px) scale(${ENTER_SCALE})`;
  }
  if (!lit) return "translate(0px, 0px) scale(1)";
  const rest = restCentre(row);
  const to = huddleCentre(row);
  return `translate(${to.cx - rest.cx}px, ${to.cy - rest.cy}px) scale(${HUDDLE_SCALE})`;
}

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
  className,
}: SharedLifeProps) {
  const rows = Array.from({ length: ROWS }, (_, row) => row);
  return (
    <svg
      aria-hidden
      data-shared-life=""
      data-lit={lit ? "" : undefined}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="xMidYMid meet"
      className={cn("block text-cream", className)}
    >
      {rows.map((row) => {
        const { cy } = restCentre(row);
        const delay = `${(row + 1) * ENTER_STAGGER_MS}ms`;
        const x1 = SLOT_W + GAP;
        return (
          <line
            key={row}
            data-line=""
            x1={x1}
            x2={x1 + LINE_W * LINE_RUNS[row]}
            y1={cy}
            y2={cy}
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            className={TRANSITION}
            style={{
              opacity: shown && !lit ? 1 : 0,
              transform: shown
                ? "translateY(0px)"
                : `translateY(${-ENTER_OUT * SLOT_H}px)`,
              transitionDelay: delay,
            }}
          />
        );
      })}
      {/* the heart is drawn last, so its red sits over the cream of the rest */}
      {[...rows.slice(1), 0].map((row) => {
        const { cx, cy } = restCentre(row);
        const heart = row === 0;
        const delay = `${(row + 1) * ENTER_STAGGER_MS}ms`;
        // the pose moves the slot's own group, so the path keeps its centring
        const style: CSSProperties = {
          transform: pose(row, shown, lit),
          transformOrigin: "center",
          transformBox: "fill-box",
          transitionDelay: delay,
          opacity: shown ? 1 : 0,
        };
        return (
          <g key={row} transform={`translate(${cx} ${cy})`}>
            <g
              data-slot={row}
              data-on={lit ? "" : undefined}
              className={TRANSITION}
              style={style}
            >
              <path
                d={BOX}
                fill={heart ? "var(--color-seal)" : "currentColor"}
                fillOpacity={lit ? (heart ? 1 : 0.2) : 0}
                stroke={heart && lit ? "var(--color-seal)" : "currentColor"}
                strokeOpacity={lit ? 0.7 : heart ? 0.5 : 0.28}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
                className={TRANSITION}
                style={{ transitionDelay: delay }}
              />
            </g>
          </g>
        );
      })}
    </svg>
  );
}
