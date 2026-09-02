import type { CSSProperties } from "react";

import { lozengePath } from "@/theme/lozenge";
import { HOUSE_CALL_STAGGER_MS, MARK_TRACE_STAGGER_MS } from "@/theme/motion";
import type { GatheringMark as Mark } from "@/content/site";
import { cn } from "@/lib/utils";

/**
 * The emblems drawn here: the two gatherings' marks, and the three the way
 * in (WayIn) adds before them — one alone, one met, and a family at a table
 */
export type Emblem = Mark | "one" | "two" | "table";

export type GatheringMarkProps = {
  mark: Emblem;
  /** rendered size, px (the drawing is 44 square) */
  size?: number;
  /**
   * whether the mark is drawn; while false its lozenges wait untraced, and
   * trace themselves in, one after the next, when it turns true
   */
  shown?: boolean;
  /** whether the reader is over the gathering: the mark gathers itself */
  lit?: boolean;
  /**
   * whether, lit, the homes are called on one after the next — the tour of
   * the house churches at the end of the way in
   */
  tour?: boolean;
  /** ms to wait before the first lozenge traces in, once shown */
  delay?: number;
  className?: string;
};

const BOX = 44;

/** the ratio of a lozenge's width to its height, the finials' own */
const LOZENGE = 2;

/** the trace takes DRAW_MS (the .9s of TRANSITION), one lozenge MARK_TRACE_STAGGER_MS after the last; on the tour the homes are called HOUSE_CALL_STAGGER_MS apart (theme/motion.ts) */

/** how far a house steps out from the table when lit, px of the drawing */
const STEP_OUT = 2.5;
/** how far the feast's outer rings draw in toward the centre when lit */
const DRAW_IN = [0.72, 0.8];
/** how far the family draws in to the table, and the pastor toward the one waiting, when lit */
const DRAW_TO = 2.5;
const MEET = 4;

/** one lozenge, and how it moves when the mark is lit */
type Piece = {
  d: string;
  /** its transform about its own centre when lit */
  lit?: string;
  /** whether it fills solid when lit */
  fills?: boolean;
  /** whether it is a home the tour calls on */
  home?: boolean;
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
      home: true,
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

/** One alone: a single lozenge at the centre, which fills when lit — the one writing to us. */
function one(): Piece[] {
  return [{ d: lozengePath(BOX / 2, BOX / 2, 12, 12 / LOZENGE), fills: true }];
}

/**
 * One met: the same lozenge, and a second a little way off to its right —
 * the pastor writing back. Lit, the second draws in beside the first, and
 * the first fills.
 */
function two(): Piece[] {
  const c = { x: BOX / 2, y: BOX / 2 };
  return [
    { d: lozengePath(c.x, c.y, 12, 12 / LOZENGE), fills: true },
    { d: lozengePath(c.x + 15, c.y, 12, 12 / LOZENGE), lit: `translate(-${MEET}px, 0px)` },
  ];
}

/**
 * A family at a table: four lozenges about one small lozenge at the centre
 * — dinner with the pastor's family. Lit, the four draw in to the table,
 * and the table fills.
 */
function table(): Piece[] {
  const c = { x: BOX / 2, y: BOX / 2 };
  const r = 14;
  const w = 11;
  const pieces: Piece[] = [];
  for (let i = 0; i < 4; i++) {
    const a = -Math.PI / 4 + (i * Math.PI) / 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    pieces.push({
      d: lozengePath(c.x + r * dx, c.y + r * dy, w, w / LOZENGE),
      lit: `translate(${(-DRAW_TO * dx).toFixed(2)}px, ${(-DRAW_TO * dy).toFixed(2)}px)`,
    });
  }
  pieces.push({ d: lozengePath(c.x, c.y, 6, 6 / LOZENGE), fills: true });
  return pieces;
}

const DRAW: Record<Emblem, () => Piece[]> = { one, two, table, homes, feast };

const TRANSITION =
  "motion-safe:[transition:stroke-dashoffset_.9s_var(--ease-site),transform_.6s_var(--ease-site),fill-opacity_.5s_ease]";

/**
 * A small emblem for a gathering, in the finials' hollow-lozenge hairline
 * (OrnateRule) and in currentColor, so it takes the seal's red from the
 * kicker beside it. Each lozenge is a unit-length path, so a dash offset
 * of 1 hides it and 0 shows it traced; the lozenges trace in one after
 * the next when `shown` turns true, and gather when `lit`. The way in
 * (WayIn) borrows the drawing for its own three emblems.
 */
export default function GatheringMark({
  mark,
  size = BOX,
  shown = true,
  lit = false,
  tour = false,
  delay = 0,
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
          transitionDelay: `${(shown ? delay : 0) + i * MARK_TRACE_STAGGER_MS}ms`,
        };
        // on the tour each home is called on in turn (house-call, index.css)
        const called = lit && tour && p.home;
        if (called) style.animationDelay = `${i * HOUSE_CALL_STAGGER_MS}ms`;
        return (
          <path
            key={p.d}
            data-called={called ? "" : undefined}
            d={p.d}
            fill="currentColor"
            fillOpacity={lit && p.fills ? 1 : 0}
            stroke="currentColor"
            strokeWidth="1"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={shown ? 0 : 1}
            className={cn(TRANSITION, called && "house-call")}
            style={style}
          />
        );
      })}
    </svg>
  );
}
