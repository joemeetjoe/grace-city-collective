import type { CSSProperties } from "react";

import {
  G_MARK_CORNER as CORNER,
  G_MARK_H as H,
  G_MARK_W as W,
  gMarkBox,
} from "@/marks/gMarkGeometry";
import { STATE } from "@/theme/classes";
import { FONT_SERIF } from "@/theme/fonts";
import { lozengePath } from "@/theme/lozenge";
import type { GatheringMark } from "@/content/site";
import { cn } from "@/lib/utils";
import {
  CALENDAR_BAND,
  CALENDAR_GAP,
  CALENDAR_GUTTER,
  CALENDAR_HEAD,
  CALENDAR_VIEW_H,
  CALENDAR_VIEW_H_ACROSS,
  CALENDAR_VIEW_W,
  CALENDAR_VIEW_W_ACROSS,
  DAYS,
  WEEKS,
} from "./gatheringCalendarMetrics";
import Tile from "./Tile";
import { AT_REST, enterPose, fadeStyle, stagger, tileTransition } from "./tileGeometry";

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

/** the week numerals over the month */
const NUMERALS = ["I", "II", "III", "IV"] as const;

/** the month across: the head row over the days is the gutter's height (gatheringCalendarMetrics.ts) */
const CALENDAR_HEAD_ACROSS = CALENDAR_GUTTER;

/** a day's box, in the logo's units */
const TILE = gMarkBox(0, CORNER);
const TILE_TO_CENTRE = `translate(${-W / 2} ${-H / 2})`;
/** the week numerals' size */
const NUMERAL = Math.round(H * 0.42);
/** the rule's lozenge finials */
const FINIAL_W = Math.round(H * 0.22);
/** the size of the S at each end of the week */
const S_SIZE = Math.round(H * 0.62);

/** the days keep their stroke colour whatever their state, so it is left out of the transition */
const TRANSITION = tileTransition(["fill", "fill-opacity", "stroke-opacity", "opacity", "transform"]);

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
function centre(week: number, day: number, across: boolean): { cx: number; cy: number } {
  if (across) {
    return {
      cx: CALENDAR_GUTTER + day * (W + CALENDAR_GAP) + W / 2 + (day > 0 ? CALENDAR_BAND : 0),
      cy: CALENDAR_HEAD_ACROSS + week * (H + CALENDAR_GAP) + H / 2,
    };
  }
  return {
    cx: CALENDAR_GUTTER + week * (W + CALENDAR_GAP) + W / 2,
    cy: CALENDAR_HEAD + day * (H + CALENDAR_GAP) + H / 2 + (day > 0 ? CALENDAR_BAND : 0),
  };
}

/** where a piece of the month's furniture sits, in the logo's units */
type Spot = { x: number; y: number };
/** the rule between the Sundays and the week, with a lozenge finial at each end */
type Rule = {
  from: Spot;
  to: Spot;
  finials: Array<Spot & { w: number; h: number; d: string }>;
};
/** a day of the month: its centre either way up, and its turn in the cascade */
type Day = { week: number; day: number; sunday: boolean; cx: number; cy: number; delay: string };

/** the month's furniture for either way up: its extent, the numerals' places, the S marks', the rule, and the days */
type Furniture = {
  viewW: number;
  viewH: number;
  numerals: Spot[];
  marks: Spot[];
  rule: Rule;
  days: Day[];
};

function furnish(across: boolean): Furniture {
  const finialAt = (x: number, y: number, w: number, h: number) => ({ x, y, w, h, d: lozengePath(x, y, w, h) });
  const days: Day[] = [];
  for (let day = 0; day < DAYS; day++) {
    for (let week = 0; week < WEEKS; week++) {
      days.push({ week, day, sunday: day === 0, ...centre(week, day, across), delay: stagger(week + day) });
    }
  }
  const weeks = Array.from({ length: WEEKS }, (_, week) => week);
  const ends = [0, DAYS - 1];
  if (across) {
    // the numerals run down the gutter at each week's row, the S marks stand
    // over the Sunday and Saturday columns, and the rule stands between the
    // Sundays' column and the week, its finials turned tall with it
    const x = CALENDAR_GUTTER + W + CALENDAR_GAP + CALENDAR_BAND / 2;
    return {
      viewW: CALENDAR_VIEW_W_ACROSS,
      viewH: CALENDAR_VIEW_H_ACROSS,
      numerals: weeks.map((week) => ({ x: CALENDAR_GUTTER / 2, y: centre(week, 0, true).cy })),
      marks: ends.map((day) => ({ x: centre(0, day, true).cx, y: CALENDAR_HEAD_ACROSS / 2 })),
      rule: {
        from: { x, y: CALENDAR_HEAD_ACROSS + FINIAL_W * 1.5 },
        to: { x, y: CALENDAR_VIEW_H_ACROSS - FINIAL_W * 1.5 },
        finials: [
          finialAt(x, CALENDAR_HEAD_ACROSS + FINIAL_W / 2, FINIAL_W / 2, FINIAL_W),
          finialAt(x, CALENDAR_VIEW_H_ACROSS - FINIAL_W / 2, FINIAL_W / 2, FINIAL_W),
        ],
      },
      days,
    };
  }
  const y = CALENDAR_HEAD + H + CALENDAR_GAP + CALENDAR_BAND / 2;
  return {
    viewW: CALENDAR_VIEW_W,
    viewH: CALENDAR_VIEW_H,
    numerals: weeks.map((week) => ({ x: centre(week, 0, false).cx, y: NUMERAL })),
    marks: ends.map((day) => ({ x: CALENDAR_GUTTER / 2 - FINIAL_W / 2, y: centre(0, day, false).cy })),
    rule: {
      from: { x: CALENDAR_GUTTER + FINIAL_W * 1.5, y },
      to: { x: CALENDAR_VIEW_W - FINIAL_W * 1.5, y },
      finials: [
        finialAt(CALENDAR_GUTTER + FINIAL_W / 2, y, FINIAL_W, FINIAL_W / 2),
        finialAt(CALENDAR_VIEW_W - FINIAL_W / 2, y, FINIAL_W, FINIAL_W / 2),
      ],
    },
    days,
  };
}

/** the month furnished both ways up, once */
const UPRIGHT = furnish(false);
const ACROSS = furnish(true);

/** the S at each end of the week: Sunday bright, Saturday quiet */
const MARK_OPACITY = [0.7, 0.35];

/** the furniture's fades, by its turn in the cascade (the numerals by week, the rule after them, the S marks by day), shown and waiting */
const FADES: Array<{ shown: CSSProperties; waiting: CSSProperties }> = Array.from(
  { length: DAYS },
  (_, order) => ({ shown: fadeStyle(true, stagger(order)), waiting: fadeStyle(false, stagger(order)) }),
);
const fade = (order: number, shown: boolean) => (shown ? FADES[order].shown : FADES[order].waiting);

/** a waiting day's pose: back along the mark's diagonal, and small */
const WAITING = enterPose(-1, -1, H);

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
  const { viewW, viewH, numerals, marks, rule, days } = across ? ACROSS : UPRIGHT;
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${viewW} ${viewH}`}
      preserveAspectRatio="xMidYMin meet"
      className={cn("block text-cream", className, lit && STATE.lit)}
    >
      {NUMERALS.map((n, week) => (
        <text
          key={n}
          x={numerals[week].x}
          y={numerals[week].y}
          textAnchor="middle"
          dominantBaseline={across ? "central" : undefined}
          fontSize={NUMERAL}
          fontFamily={FONT_SERIF}
          letterSpacing={NUMERAL * 0.12}
          fill="currentColor"
          fillOpacity={0.45}
          className={TRANSITION}
          style={fade(week, shown)}
        >
          {n}
        </text>
      ))}
      {/* the rule under the Sundays (across, beside them), with a lozenge finial at each end in the seal's red */}
      <g className={TRANSITION} style={fade(WEEKS, shown)}>
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
        {rule.finials.map(({ x, y, d }) => (
          <path
            key={`${x}-${y}`}
            d={d}
            fill="none"
            stroke="var(--color-seal)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </g>
      {/* the S at each end of the week: Sunday over the rule, Saturday at the foot (across, over the first and last columns) */}
      {marks.map((mark, end) => (
        <text
          key={end}
          x={mark.x}
          y={mark.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={S_SIZE}
          fontFamily={FONT_SERIF}
          fill="currentColor"
          fillOpacity={MARK_OPACITY[end]}
          className={TRANSITION}
          style={fade(end === 0 ? 0 : DAYS - 1, shown)}
        >
          S
        </text>
      ))}
      {days.map((d) => {
        const on = isLit(lit, d.week, d.day);
        return (
          <Tile
            key={`${d.week}-${d.day}`}
            cx={d.cx}
            cy={d.cy}
            d={TILE}
            pathTransform={TILE_TO_CENTRE}
            transform={shown ? AT_REST : WAITING}
            delay={d.delay}
            shown={shown}
            fill={lit === "feast" ? "var(--color-seal)" : "currentColor"}
            fillOpacity={on ? 1 : 0}
            stroke="currentColor"
            strokeOpacity={on ? 0.9 : lit ? 0.14 : d.sunday ? 0.5 : 0.28}
            transition={TRANSITION}
            className={on ? STATE.on : undefined}
          />
        );
      })}
    </svg>
  );
}
