import type { CSSProperties } from "react";

import { lozengePath } from "@/components/lozenge";
import type { GatheringMark as Mark } from "@/content/site";
import { cn } from "@/lib/utils";

export type GatheringMarkProps = {
  mark: Mark;
  /** rendered size, px (the drawing is 44 square) */
  size?: number;
  /**
   * whether the mark is drawn; while false its lozenges wait untraced, and
   * trace themselves in, one after the next, when it turns true
   */
  shown?: boolean;
  /** whether the reader is over the gathering: the mark gathers itself */
  lit?: boolean;
  className?: string;
};

const BOX = 44;

/** the ratio of a lozenge's width to its height, the finials' own */
const LOZENGE = 2;

/** the trace, in ms, and the wait between one lozenge and the next */
export const TRACE_MS = 900;
export const TRACE_STAGGER_MS = 120;

/** how far a house steps out from the table when lit, px of the drawing */
const STEP_OUT = 2.5;
/** how far the feast's outer rings draw in toward the centre when lit */
const DRAW_IN = [0.72, 0.8];

/** one lozenge, and how it moves when the mark is lit */
type Piece = {
  d: string;
  /** its transform about its own centre when lit */
  lit?: string;
  /** whether it fills solid when lit */
  fills?: boolean;
};

/**
 * The five house churches: five hollow lozenges in a ring around one small
 * lozenge at the centre — five rooms about one table. Lit, the five step
 * out a little from the table, and the table fills.
 */
function homes(): Piece[] {
  const c = { x: BOX / 2, y: BOX / 2 + 1 };
  const r = 15;
  const w = 12;
  const pieces: Piece[] = [];
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    pieces.push({
      d: lozengePath(c.x + r * dx, c.y + r * dy, w, w / LOZENGE),
      lit: `translate(${(STEP_OUT * dx).toFixed(2)}px, ${(STEP_OUT * dy).toFixed(2)}px)`,
    });
  }
  pieces.push({ d: lozengePath(c.x, c.y, 6, 6 / LOZENGE), fills: true });
  return pieces;
}

/**
 * The all-church gathering: three lozenges nested one inside the next —
 * the five rooms become one, the whole family in one place. Lit, the outer
 * rings draw in toward the centre, and the centre fills.
 */
function feast(): Piece[] {
  const c = { x: BOX / 2, y: BOX / 2 };
  return [40, 26, 12].map((w, i) => ({
    d: lozengePath(c.x, c.y, w, w / LOZENGE),
    ...(i < DRAW_IN.length ? { lit: `scale(${DRAW_IN[i]})` } : { fills: true }),
  }));
}

const DRAW: Record<Mark, () => Piece[]> = { homes, feast };

const TRANSITION =
  "motion-safe:[transition:stroke-dashoffset_.9s_cubic-bezier(0.16,1,0.3,1),transform_.6s_cubic-bezier(0.16,1,0.3,1),fill-opacity_.5s_ease]";

/**
 * A small emblem for a gathering, in the finials' hollow-lozenge hairline
 * (OrnateRule) and in currentColor, so it takes the seal's red from the
 * kicker beside it. Each lozenge is a unit-length path, so a dash offset
 * of 1 hides it and 0 shows it traced; the lozenges trace in one after
 * the next when `shown` turns true, and gather when `lit`.
 */
export default function GatheringMark({
  mark,
  size = BOX,
  shown = true,
  lit = false,
  className,
}: GatheringMarkProps) {
  return (
    <svg
      aria-hidden
      data-gathering-mark={mark}
      data-lit={lit ? "" : undefined}
      width={size}
      height={size}
      viewBox={`0 0 ${BOX} ${BOX}`}
      className={cn("shrink-0", className)}
    >
      {DRAW[mark]().map((p, i) => {
        const style: CSSProperties = {
          transform: lit && p.lit ? p.lit : "none",
          transformBox: "fill-box",
          transformOrigin: "center",
          transitionDelay: `${i * TRACE_STAGGER_MS}ms`,
        };
        return (
          <path
            key={p.d}
            d={p.d}
            fill="currentColor"
            fillOpacity={lit && p.fills ? 1 : 0}
            stroke="currentColor"
            strokeWidth="1"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={shown ? 0 : 1}
            className={TRANSITION}
            style={style}
          />
        );
      })}
    </svg>
  );
}
