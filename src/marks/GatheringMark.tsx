import { memo, type CSSProperties, type Ref } from "react";

import { HOUSE_CALL_STAGGER_MS, MARK_TRACE_STAGGER_MS } from "@/theme/motion";
import { EMBLEMS, GATHERING_BOX as BOX, type Emblem } from "./gatheringMarkPaths";
import { cn } from "@/lib/utils";

export type { Emblem } from "./gatheringMarkPaths";

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
  ref?: Ref<SVGSVGElement>;
};

const VIEWBOX = `0 0 ${BOX} ${BOX}`;

/** the trace takes DRAW_MS (the .9s of TRANSITION), one lozenge MARK_TRACE_STAGGER_MS after the last; on the tour the homes are called HOUSE_CALL_STAGGER_MS apart (theme/motion.ts) */
const TRANSITION =
  "motion-safe:[transition:stroke-dashoffset_.9s_var(--ease-site),transform_.6s_var(--ease-site),fill-opacity_.5s_ease]";

/**
 * A small emblem for a gathering, in the finials' hollow-lozenge hairline
 * (OrnateRule) and in currentColor, so it takes the seal's red from the
 * kicker beside it. Each lozenge is a unit-length path, so a dash offset
 * of 1 hides it and 0 shows it traced; the lozenges trace in one after
 * the next when `shown` turns true, and gather when `lit`. The drawings
 * are gatheringMarkPaths.ts; the way in (WayIn) borrows them for its own
 * three emblems.
 */
function GatheringMark({
  mark,
  size = BOX,
  shown = true,
  lit = false,
  tour = false,
  delay = 0,
  className,
  ref,
}: GatheringMarkProps) {
  return (
    <svg
      aria-hidden
      data-gathering-mark={mark}
      data-lit={lit ? "" : undefined}
      width={size}
      height={size}
      viewBox={VIEWBOX}
      className={cn("shrink-0", className)}
      ref={ref}
    >
      {EMBLEMS[mark].map((p, i) => {
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
            key={p.id}
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

export default memo(GatheringMark);
