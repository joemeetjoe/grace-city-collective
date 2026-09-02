import type { CSSProperties } from "react";

import {
  G_MARK_CORNER as CORNER,
  G_MARK_H as H,
  G_MARK_W as W,
  gMarkBox,
} from "@/marks/gMarkGeometry";
import { FONT_SERIF } from "@/theme/fonts";
import { lozengePath } from "@/theme/lozenge";
import type { GatheringMark } from "@/content/site";
import { TILE_STAGGER_MS } from "@/theme/motion";
import { cn } from "@/lib/utils";

export type GatheringCalendarProps = {
  /**
   * which gathering is lit: `feast` fills the first Sunday in the seal's
   * red, the all-church gathering; `homes` fills the other Sundays cream,
   * the weeks the house churches meet. Null leaves the month at rest.
   */
  lit?: GatheringMark | null;
  /**
   * whether the days are in place; while false they wait faded, back along
   * the diagonal, and cascade in from the first Sunday when it turns true
   */
  shown?: boolean;
  /**
   * the month transposed: the seven days across and the four weeks down,
   * the Sundays a column at the left — for a phone card, where the words
   * run above it and a tall column would push everything down. The
   * lettering stays upright; only the grid turns
   */
  across?: boolean;
  className?: string;
};

/** a month set on its side: four weeks across, the seven days down, Sundays on top */
export const WEEKS = 4;
export const DAYS = 7;
const NUMERALS = ["I", "II", "III", "IV"] as const;

/** a day's box, in the logo's units, and the gap between neighbours */
const TILE = gMarkBox(0, CORNER);
const GAP = Math.round(H * 0.22);
/** the week numerals' row above the month, and their size */
const HEAD = Math.round(H * 0.8);
const NUMERAL = Math.round(H * 0.42);
/** the band between the Sundays and the week, with the rule through it */
const BAND = Math.round(H * 0.7);
/** the rule's lozenge finials */
const FINIAL_W = Math.round(H * 0.22);
/** the gutter on the left for the S at each end of the week, and its size */
const GUTTER = Math.round(H * 0.9);
const S_SIZE = Math.round(H * 0.62);

/** how far out along the diagonal a waiting day sits, in its own heights */
const ENTER_OUT = 0.6;
export const ENTER_SCALE = 0.55;
/** the cascade: one diagonal of days after the next (TILE_STAGGER_MS) */

/** the month's extent, in the logo's units */
export const VIEW_W = GUTTER + WEEKS * W + (WEEKS - 1) * GAP;
export const VIEW_H = HEAD + DAYS * H + (DAYS - 1) * GAP + BAND;
/**
 * the month across: the head row over the days holds the S at each end of
 * the week, the gutter at the left the week numerals, and the band with the
 * rule stands between the Sundays' column and the six weekdays
 */
const HEAD_ACROSS = GUTTER;
export const VIEW_W_ACROSS = GUTTER + DAYS * W + (DAYS - 1) * GAP + BAND;
export const VIEW_H_ACROSS = HEAD_ACROSS + WEEKS * H + (WEEKS - 1) * GAP;

const TRANSITION =
  "motion-safe:[transition:fill_.5s_ease,fill-opacity_.5s_ease,stroke-opacity_.5s_ease,opacity_.9s_var(--ease-site),transform_.9s_var(--ease-site)]";

/** whether a day is lit for the gathering: the first Sunday, or the other Sundays */
function isLit(lit: GatheringMark | null, week: number, day: number): boolean {
  if (day !== 0) return false;
  if (lit === "feast") return week === 0;
  if (lit === "homes") return week > 0;
  return false;
}

/**
 * a day's centre, in the logo's units: the Sundays sit above the band — or,
 * across, to its left
 */
function centre(
  week: number,
  day: number,
  across = false,
): { cx: number; cy: number } {
  if (across) {
    return {
      cx: GUTTER + day * (W + GAP) + W / 2 + (day > 0 ? BAND : 0),
      cy: HEAD_ACROSS + week * (H + GAP) + H / 2,
    };
  }
  return {
    cx: GUTTER + week * (W + GAP) + W / 2,
    cy: HEAD + day * (H + GAP) + H / 2 + (day > 0 ? BAND : 0),
  };
}

/** where a piece of the month's furniture sits, in the logo's units */
type Spot = { x: number; y: number };
/** the rule between the Sundays and the week, with a lozenge finial at each end */
type Rule = {
  from: Spot;
  to: Spot;
  finials: Array<Spot & { w: number; h: number }>;
};

/** the month's furniture for either way up: its extent, the numerals' places, the S marks', and the rule */
function furniture(across: boolean): {
  viewW: number;
  viewH: number;
  numeral: (week: number) => Spot;
  mark: (day: number) => Spot;
  rule: Rule;
} {
  if (across) {
    // the numerals run down the gutter at each week's row, the S marks stand
    // over the Sunday and Saturday columns, and the rule stands between the
    // Sundays' column and the week, its finials turned tall with it
    const x = GUTTER + W + GAP + BAND / 2;
    const finial = { w: FINIAL_W / 2, h: FINIAL_W };
    return {
      viewW: VIEW_W_ACROSS,
      viewH: VIEW_H_ACROSS,
      numeral: (week) => ({ x: GUTTER / 2, y: centre(week, 0, true).cy }),
      mark: (day) => ({ x: centre(0, day, true).cx, y: HEAD_ACROSS / 2 }),
      rule: {
        from: { x, y: HEAD_ACROSS + FINIAL_W * 1.5 },
        to: { x, y: VIEW_H_ACROSS - FINIAL_W * 1.5 },
        finials: [
          { x, y: HEAD_ACROSS + FINIAL_W / 2, ...finial },
          { x, y: VIEW_H_ACROSS - FINIAL_W / 2, ...finial },
        ],
      },
    };
  }
  const y = HEAD + H + GAP + BAND / 2;
  const finial = { w: FINIAL_W, h: FINIAL_W / 2 };
  return {
    viewW: VIEW_W,
    viewH: VIEW_H,
    numeral: (week) => ({ x: centre(week, 0).cx, y: NUMERAL }),
    mark: (day) => ({ x: GUTTER / 2 - FINIAL_W / 2, y: centre(0, day).cy }),
    rule: {
      from: { x: GUTTER + FINIAL_W * 1.5, y },
      to: { x: VIEW_W - FINIAL_W * 1.5, y },
      finials: [
        { x: GUTTER + FINIAL_W / 2, y, ...finial },
        { x: VIEW_W - FINIAL_W / 2, y, ...finial },
      ],
    },
  };
}

/** a day's transform about its own centre, in the logo's units */
function pose(shown: boolean): string {
  if (!shown) {
    const out = -ENTER_OUT * H;
    return `translate(${out}px, ${out}px) scale(${ENTER_SCALE})`;
  }
  return "translate(0px, 0px) scale(1)";
}

/**
 * A month of Sundays, drawn as a calendar of the G mark's box — rounded
 * top-left and bottom-right, pointed on the other two corners — in a cream
 * hairline, the finials' weight. The month is set on its side to fill a
 * tall column: the four weeks run across under roman numerals, the seven
 * days run down, and the Sundays stand on top, set apart from the week by
 * a hairline rule with lozenge finials, the way a section's kicker sits
 * over its rule. An S in the gutter marks each end of the week — Sunday
 * bright at the top, Saturday quiet at the foot — and nothing else names
 * the days. The days cascade in along the mark's diagonal when the
 * panel around them is shown, and the Sundays light for whichever
 * gathering the reader is over: the first fills the seal's red for the
 * all-church gathering; the other three fill cream for the house churches.
 * The drawing fits whatever box it is given, from the top.
 *
 * Across, for a phone card, the month is transposed rather than turned, so
 * its lettering stays upright: the seven days run across and the four weeks
 * down, the Sundays a column at the left set apart from the week by the
 * rule standing on end, the numerals down the gutter at each week's row,
 * and the S over the first and last columns. A wide, short drawing.
 */
export default function GatheringCalendar({
  lit = null,
  shown = true,
  across = false,
  className,
}: GatheringCalendarProps) {
  const days: Array<{ week: number; day: number }> = [];
  for (let day = 0; day < DAYS; day++) {
    for (let week = 0; week < WEEKS; week++) days.push({ week, day });
  }
  const { viewW, viewH, numeral, mark, rule } = furniture(across);
  const fade = (order: number): CSSProperties => ({
    opacity: shown ? 1 : 0,
    transitionDelay: `${order * TILE_STAGGER_MS}ms`,
  });
  return (
    <svg
      aria-hidden
      data-gathering-calendar=""
      data-lit={lit ?? undefined}
      data-across={across ? "" : undefined}
      viewBox={`0 0 ${viewW} ${viewH}`}
      preserveAspectRatio="xMidYMin meet"
      className={cn("block text-cream", className)}
    >
      {NUMERALS.map((n, week) => (
        <text
          key={n}
          x={numeral(week).x}
          y={numeral(week).y}
          textAnchor="middle"
          dominantBaseline={across ? "central" : undefined}
          fontSize={NUMERAL}
          fontFamily={FONT_SERIF}
          letterSpacing={NUMERAL * 0.12}
          fill="currentColor"
          fillOpacity={0.45}
          className={TRANSITION}
          style={fade(week)}
        >
          {n}
        </text>
      ))}
      {/* the rule under the Sundays (across, beside them), with a lozenge finial at each end in the seal's red */}
      <g data-sunday-rule="" className={TRANSITION} style={fade(WEEKS)}>
        <line
          x1={rule.from.x}
          x2={rule.to.x}
          y1={rule.from.y}
          y2={rule.to.y}
          stroke="currentColor"
          strokeOpacity={0.3}
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {rule.finials.map(({ x, y, w, h }) => (
          <path
            key={`${x}-${y}`}
            d={lozengePath(x, y, w, h)}
            fill="none"
            stroke="var(--color-seal)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      {/* the S at each end of the week: Sunday over the rule, Saturday at the foot (across, over the first and last columns) */}
      {[
        { day: 0, name: "sunday", opacity: 0.7 },
        { day: DAYS - 1, name: "saturday", opacity: 0.35 },
      ].map(({ day, name, opacity }) => (
        <text
          key={name}
          data-day-mark={name}
          x={mark(day).x}
          y={mark(day).y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={S_SIZE}
          fontFamily={FONT_SERIF}
          fill="currentColor"
          fillOpacity={opacity}
          className={TRANSITION}
          style={fade(day)}
        >
          S
        </text>
      ))}
      {days.map(({ week, day }) => {
        const on = isLit(lit, week, day);
        const sunday = day === 0;
        const { cx, cy } = centre(week, day, across);
        const delay = `${(week + day) * TILE_STAGGER_MS}ms`;
        // the pose moves the day's own group, so the path keeps its centring
        const style: CSSProperties = {
          transform: pose(shown),
          transformOrigin: "center",
          transformBox: "fill-box",
          transitionDelay: delay,
          opacity: shown ? 1 : 0,
        };
        return (
          <g key={`${week}-${day}`} transform={`translate(${cx} ${cy})`}>
            <g
              data-day=""
              data-on={on ? "" : undefined}
              className={TRANSITION}
              style={style}
            >
              <path
                transform={`translate(${-W / 2} ${-H / 2})`}
                d={TILE}
                fill={lit === "feast" ? "var(--color-seal)" : "currentColor"}
                fillOpacity={on ? 1 : 0}
                stroke="currentColor"
                strokeOpacity={on ? 0.9 : lit ? 0.14 : sunday ? 0.5 : 0.28}
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
