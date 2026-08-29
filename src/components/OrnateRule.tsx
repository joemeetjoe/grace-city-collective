import type { CSSProperties } from "react";

import { lozengePath } from "@/components/lozenge";
import { cn } from "@/lib/utils";

export type RuleEnds = "both" | "start" | "end";

export type OrnateRuleProps = {
  /** which ends carry the lozenges; a corner arm carries one at its free end only */
  ends?: RuleEnds;
  /** run top to bottom instead of left to right */
  vertical?: boolean;
  className?: string;
  style?: CSSProperties;
};

/** the two lozenges of a finial, in px: the outer one small, the inner one larger */
const SMALL = { w: 10, h: 5 };
const LARGE = { w: 14, h: 7 };
const GAP = 3;

function Lozenge({ w, h, vertical }: { w: number; h: number; vertical: boolean }) {
  // a hollow diamond, hairline; drawn on half-pixels so the stroke stays crisp
  const d = lozengePath(w / 2, h / 2, w, h);
  const dv = lozengePath(h / 2, w / 2, h, w);
  return (
    <svg
      aria-hidden
      data-lozenge=""
      width={vertical ? h : w}
      height={vertical ? w : h}
      viewBox={vertical ? `0 0 ${h} ${w}` : `0 0 ${w} ${h}`}
      className="shrink-0"
    >
      <path d={vertical ? dv : d} fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/**
 * A hairline with a finial of two hollow lozenges at either end — the small
 * one outermost — in currentColor. The line takes whatever room the rule
 * is given, so it works as a paragraph separator at any width and, with
 * one finial, as an arm of a corner ornament.
 */
export default function OrnateRule({ ends = "both", vertical = false, className, style }: OrnateRuleProps) {
  const start = ends !== "end";
  const end = ends !== "start";
  return (
    <span
      aria-hidden
      data-ornate-rule={ends}
      className={cn("flex items-center", vertical ? "flex-col" : "flex-row", className)}
      style={{ gap: GAP, ...style }}
    >
      {start && <Lozenge {...SMALL} vertical={vertical} />}
      {start && <Lozenge {...LARGE} vertical={vertical} />}
      <span data-rule-line="" className={cn("block flex-1 bg-current", vertical ? "w-px" : "h-px")} />
      {end && <Lozenge {...LARGE} vertical={vertical} />}
      {end && <Lozenge {...SMALL} vertical={vertical} />}
    </span>
  );
}
