import { memo, useMemo, type CSSProperties, type Ref } from "react";

import OrnateRule, { type RuleEnds } from "./OrnateRule";
import { COPY_ARM, ENTER_OFFSET, ENTER_SCALE } from "./cornerOrnamentsMetrics";
import { BRACKET_STAGGER_MS, ENTER_MS } from "@/theme/motion";
import { cn } from "@/lib/utils";

export type CornerOrnamentsProps = {
  /** an arm's length */
  arm?: string;
  /** how far inside the box's edges the arms sit (negative: outside) */
  inset?: string;
  /**
   * whether the brackets are in place; while false they wait faded, set
   * back from their corners, and slide home when it turns true
   */
  shown?: boolean;
  className?: string;
  ref?: Ref<HTMLDivElement>;
};

/** the entrance (ENTER_MS, one arm a beat after the last: BRACKET_STAGGER_MS) on the site's ease, only where motion is welcome */
const ENTER = "motion-safe:transition-[opacity,transform] motion-safe:ease-site";
const ARM_CLASS = cn("absolute", ENTER);

/** an arm, settled once: which corner it sits at, which way it runs, and its entrance */
type Arm = {
  /** the edge it runs along: names the arm */
  id: "top" | "right" | "bottom" | "left";
  ends: RuleEnds;
  vertical: boolean;
  /** the corner's two edges, which take the inset */
  edges: readonly ["top" | "bottom", "left" | "right"];
  /** the dimension that takes the arm's length */
  span: "width" | "height";
  /** its beat in the entrance */
  order: number;
  /** the transition, and where the arm grows from */
  motion: CSSProperties;
  /** out past its corner along both axes, shrunk towards the corner and faded */
  waiting: CSSProperties;
};

/** home: in place, at full length */
const HOME: CSSProperties = { opacity: 1, transform: "translate(0px, 0px) scale(1)" };

function arm(
  id: Arm["id"],
  ends: RuleEnds,
  vertical: boolean,
  edges: Arm["edges"],
  dx: number,
  dy: number,
  origin: string,
  order: number,
): Arm {
  return {
    id,
    ends,
    vertical,
    edges,
    span: vertical ? "height" : "width",
    order,
    motion: {
      transformOrigin: origin,
      transitionDuration: `${ENTER_MS}ms`,
      transitionDelay: `${order * BRACKET_STAGGER_MS}ms`,
    },
    waiting: { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(${ENTER_SCALE})` },
  };
}

const o = ENTER_OFFSET;
/**
 * The four arms in drawing order. Top-right: one running left along the
 * top, one running down the side, both growing from the corner. Bottom-left:
 * one running right along the bottom, one running up the side.
 */
const ARMS: readonly Arm[] = [
  arm("top", "start", false, ["top", "right"], o, -o, "100% 50%", 0),
  arm("right", "end", true, ["top", "right"], o, -o, "50% 0%", 1),
  arm("bottom", "end", false, ["bottom", "left"], -o, o, "0% 50%", 2),
  arm("left", "start", true, ["bottom", "left"], -o, o, "50% 100%", 3),
];

/**
 * An arm's style at rest or waiting: at its corner, its length, then the
 * entrance — shown, it slides home and grows to full length, each arm a
 * beat after the last, its line drawing out from the corner and its
 * lozenges tracing in as it lands (OrnateRule's drawn, on the same beat).
 */
function armStyle(a: Arm, length: string, inset: string, shown: boolean): CSSProperties {
  const style: CSSProperties = {};
  style[a.edges[0]] = inset;
  style[a.edges[1]] = inset;
  style[a.span] = length;
  return Object.assign(style, a.motion, shown ? HOME : a.waiting);
}

/**
 * Two square corners — top-right and bottom-left — each take a bracket of
 * two arms meeting at the corner and ending in lozenge finials, in the
 * seal's red; the other two corners go bare, like the G mark whose shape
 * the frame follows. Absolute over its box: give the parent `relative`.
 */
function CornerOrnaments({ arm: length = COPY_ARM, inset = "0px", shown = true, className, ref }: CornerOrnamentsProps) {
  const styles = useMemo(() => ARMS.map((a) => armStyle(a, length, inset, shown)), [length, inset, shown]);
  return (
    <div
      aria-hidden
      data-corner-ornaments=""
      data-shown={shown ? "true" : "false"}
      className={cn("pointer-events-none absolute inset-0 text-seal", className)}
      ref={ref}
    >
      {ARMS.map((a, i) => (
        <OrnateRule
          key={a.id}
          ends={a.ends}
          vertical={a.vertical}
          drawn={shown}
          delay={a.order * BRACKET_STAGGER_MS}
          className={ARM_CLASS}
          style={styles[i]}
        />
      ))}
    </div>
  );
}

export default memo(CornerOrnaments);
