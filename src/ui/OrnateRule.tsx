import { memo, type CSSProperties, type Ref } from "react";

import { cssVars } from "@/theme/cssVars";
import { lozengeLength, lozengePath } from "@/theme/lozenge";
import { LINE_MS, LOZENGE_AT_MS, LOZENGE_MS, LOZENGE_STAGGER_MS } from "@/theme/motion";
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

const GAP = 3;

/** the line (LINE_MS) and the lozenges (LOZENGE_MS) draw on the site's ease, only where motion is welcome */
const DRAW_EASE = "motion-safe:ease-site";
const LINE_DURATION = `${LINE_MS}ms`;
const LOZENGE_DURATION = `${LOZENGE_MS}ms`;

/** a finial lozenge as drawn: its box, and its hollow diamond, hairline, on half-pixels so the stroke stays crisp */
type LozengeArt = {
  width: number;
  height: number;
  viewBox: string;
  d: string;
  /** its perimeter: the whole of it is one dash, offset out of sight until drawn */
  len: number;
};

function lozengeArt(w: number, h: number, vertical: boolean): LozengeArt {
  const width = vertical ? h : w;
  const height = vertical ? w : h;
  return {
    width,
    height,
    viewBox: `0 0 ${width} ${height}`,
    d: lozengePath(width / 2, height / 2, width, height),
    len: lozengeLength(w, h),
  };
}

/** the two lozenges of a finial, in px — the outer one small, the inner one larger — either way up, settled once */
const ART = {
  across: { small: lozengeArt(10, 5, false), large: lozengeArt(14, 7, false) },
  down: { small: lozengeArt(10, 5, true), large: lozengeArt(14, 7, true) },
};

function Lozenge({ art, drawn, delay }: { art: LozengeArt; drawn: boolean; delay: number }) {
  return (
    <svg aria-hidden data-lozenge="" width={art.width} height={art.height} viewBox={art.viewBox} className="shrink-0">
      <path
        d={art.d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        className={cn(
          "motion-safe:transition-[stroke-dashoffset]",
          DRAW_EASE,
          !drawn && "motion-safe:[stroke-dashoffset:var(--len)]",
        )}
        style={cssVars({
          strokeDasharray: art.len,
          "--len": art.len,
          transitionDuration: LOZENGE_DURATION,
          transitionDelay: `${delay}ms`,
        })}
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
function OrnateRule({
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
  const art = vertical ? ART.down : ART.across;
  return (
    <span
      ref={ref}
      aria-hidden
      data-ornate-rule={ends}
      data-drawn={drawn ? "true" : "false"}
      className={cn("flex items-center", vertical ? "flex-col" : "flex-row", className)}
      style={{ gap: GAP, ...style }}
    >
      {start && <Lozenge art={art.small} drawn={drawn} delay={small} />}
      {start && <Lozenge art={art.large} drawn={drawn} delay={large} />}
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
          transitionDuration: LINE_DURATION,
          transitionDelay: `${delay}ms`,
        }}
      />
      {end && <Lozenge art={art.large} drawn={drawn} delay={large} />}
      {end && <Lozenge art={art.small} drawn={drawn} delay={small} />}
    </span>
  );
}

export default memo(OrnateRule);
