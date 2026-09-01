import type { CSSProperties, Ref } from "react";

import { lozengeLength, lozengePath } from "@/theme/lozenge";
import { cn } from "@/lib/utils";

export type RuleEnds = "both" | "start" | "end";

export type OrnateRuleProps = {
  /** which ends carry the lozenges; a corner arm carries one at its free end only */
  ends?: RuleEnds;
  /** run top to bottom instead of left to right */
  vertical?: boolean;
  /**
   * whether the rule is drawn; while false the line waits at no length and
   * the lozenges untraced, and when it turns true the line draws out, then
   * the lozenges trace in, large before small
   */
  drawn?: boolean;
  /** ms before the drawing starts */
  delay?: number;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLSpanElement>;
};

/** the two lozenges of a finial, in px: the outer one small, the inner one larger */
const SMALL = { w: 10, h: 5 };
const LARGE = { w: 14, h: 7 };
const GAP = 3;

/** how long the line takes to draw, in ms */
export const DRAW_MS = 1000;
/** how long a lozenge takes to trace, when the large ones start, and how long after them the small */
export const LOZENGE_MS = 500;
export const LOZENGE_AT_MS = 750;
export const LOZENGE_STAGGER_MS = 300;

const DRAW_EASE = "motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]";

function Lozenge({
  w,
  h,
  vertical,
  drawn,
  delay,
}: {
  w: number;
  h: number;
  vertical: boolean;
  drawn: boolean;
  delay: number;
}) {
  // a hollow diamond, hairline; drawn on half-pixels so the stroke stays crisp
  const d = lozengePath(w / 2, h / 2, w, h);
  const dv = lozengePath(h / 2, w / 2, h, w);
  // traced by its dash: the whole perimeter is one dash, offset out of sight until drawn
  const len = lozengeLength(w, h);
  return (
    <svg
      aria-hidden
      data-lozenge=""
      width={vertical ? h : w}
      height={vertical ? w : h}
      viewBox={vertical ? `0 0 ${h} ${w}` : `0 0 ${w} ${h}`}
      className="shrink-0"
    >
      <path
        d={vertical ? dv : d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        className={cn(
          "motion-safe:transition-[stroke-dashoffset]",
          DRAW_EASE,
          !drawn && "motion-safe:[stroke-dashoffset:var(--len)]",
        )}
        style={
          {
            strokeDasharray: len,
            "--len": len,
            transitionDuration: `${LOZENGE_MS}ms`,
            transitionDelay: `${delay}ms`,
          } as CSSProperties
        }
      />
    </svg>
  );
}

/** where the line grows from: its middle, or the end without a finial (a corner arm's corner) */
function lineOrigin(ends: RuleEnds, vertical: boolean): string {
  if (ends === "both") return "50% 50%";
  if (ends === "start") return vertical ? "50% 100%" : "100% 50%";
  return vertical ? "50% 0%" : "0% 50%";
}

/**
 * A hairline with a finial of two hollow lozenges at either end — the small
 * one outermost — in currentColor. The line takes whatever room the rule
 * is given, so it works as a paragraph separator at any width and, with
 * one finial, as an arm of a corner ornament. Drawn in on request: the line
 * grows from its middle (or from a corner arm's corner), then the large
 * lozenges trace themselves, then the small — only where motion is welcome.
 */
export default function OrnateRule({
  ends = "both",
  vertical = false,
  drawn = true,
  delay = 0,
  className,
  style,
  ref,
}: OrnateRuleProps) {
  const start = ends !== "end";
  const end = ends !== "start";
  const large = delay + LOZENGE_AT_MS;
  const small = large + LOZENGE_STAGGER_MS;
  const lozenge = { vertical, drawn };
  return (
    <span
      ref={ref}
      aria-hidden
      data-ornate-rule={ends}
      data-drawn={drawn ? "true" : "false"}
      className={cn("flex items-center", vertical ? "flex-col" : "flex-row", className)}
      style={{ gap: GAP, ...style }}
    >
      {start && <Lozenge {...SMALL} {...lozenge} delay={small} />}
      {start && <Lozenge {...LARGE} {...lozenge} delay={large} />}
      <span
        data-rule-line=""
        className={cn(
          "block flex-1 bg-current motion-safe:transition-transform",
          DRAW_EASE,
          vertical ? "w-px" : "h-px",
          !drawn && (vertical ? "motion-safe:scale-y-0" : "motion-safe:scale-x-0"),
        )}
        style={{
          transformOrigin: lineOrigin(ends, vertical),
          transitionDuration: `${DRAW_MS}ms`,
          transitionDelay: `${delay}ms`,
        }}
      />
      {end && <Lozenge {...LARGE} {...lozenge} delay={large} />}
      {end && <Lozenge {...SMALL} {...lozenge} delay={small} />}
    </span>
  );
}
