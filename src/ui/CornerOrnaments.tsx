import type { CSSProperties } from "react";

import OrnateRule from "./OrnateRule";
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
};

/** the scene frame's brackets: inside the cream line, long arms */
export const FRAME_ARM = "clamp(72px,9vw,150px)";
export const FRAME_INSET = "calc(clamp(9px,2.4vw,26px) + 12px)";

/** a copy block's brackets: at the block's padding edge, shorter arms */
export const COPY_ARM = "clamp(44px,5.5vw,90px)";

/** how far out from its corner a waiting bracket sits, in px */
export const ENTER_OFFSET = 56;
/** how much of its length a waiting arm has grown */
export const ENTER_SCALE = 0.55;
/** the entrance, in ms, and the wait between one arm and the next */
export const ENTER_MS = 1100;
export const ENTER_STAGGER_MS = 140;

const ENTER =
  "motion-safe:transition-[opacity,transform] motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]";

/**
 * An arm's resting or waiting style. Waiting, it sits out past its corner
 * along both axes, shrunk towards the corner and faded; shown, it slides
 * home and grows to full length, each arm a beat after the last, its line
 * drawing out from the corner and its lozenges tracing in as it lands
 * (OrnateRule's drawn, on the same beat).
 */
function entrance(
  shown: boolean,
  dx: number,
  dy: number,
  origin: string,
  order: number,
): CSSProperties {
  const motion = {
    transformOrigin: origin,
    transitionDuration: `${ENTER_MS}ms`,
    transitionDelay: `${order * ENTER_STAGGER_MS}ms`,
  };
  return shown
    ? { ...motion, opacity: 1, transform: "translate(0px, 0px) scale(1)" }
    : {
        ...motion,
        opacity: 0,
        transform: `translate(${dx}px, ${dy}px) scale(${ENTER_SCALE})`,
      };
}

/**
 * Two square corners — top-right and bottom-left — each take a bracket of
 * two arms meeting at the corner and ending in lozenge finials, in the
 * seal's red; the other two corners go bare, like the G mark whose shape
 * the frame follows. Absolute over its box: give the parent `relative`.
 */
export default function CornerOrnaments({
  arm = COPY_ARM,
  inset = "0px",
  shown = true,
  className,
}: CornerOrnamentsProps) {
  const o = ENTER_OFFSET;
  return (
    <div
      aria-hidden
      data-corner-ornaments=""
      data-shown={shown ? "true" : "false"}
      className={cn(
        "pointer-events-none absolute inset-0 text-seal",
        className,
      )}
    >
      {/* top-right: an arm running left along the top, one running down the side; both grow from the corner */}
      <OrnateRule
        ends="start"
        drawn={shown}
        delay={0 * ENTER_STAGGER_MS}
        className={cn("absolute", ENTER)}
        style={{
          top: inset,
          right: inset,
          width: arm,
          ...entrance(shown, o, -o, "100% 50%", 0),
        }}
      />
      <OrnateRule
        ends="end"
        vertical
        drawn={shown}
        delay={1 * ENTER_STAGGER_MS}
        className={cn("absolute", ENTER)}
        style={{
          top: inset,
          right: inset,
          height: arm,
          ...entrance(shown, o, -o, "50% 0%", 1),
        }}
      />
      {/* bottom-left: an arm running right along the bottom, one running up the side */}
      <OrnateRule
        ends="end"
        drawn={shown}
        delay={2 * ENTER_STAGGER_MS}
        className={cn("absolute", ENTER)}
        style={{
          bottom: inset,
          left: inset,
          width: arm,
          ...entrance(shown, -o, o, "0% 50%", 2),
        }}
      />
      <OrnateRule
        ends="start"
        vertical
        drawn={shown}
        delay={3 * ENTER_STAGGER_MS}
        className={cn("absolute", ENTER)}
        style={{
          bottom: inset,
          left: inset,
          height: arm,
          ...entrance(shown, -o, o, "50% 100%", 3),
        }}
      />
    </div>
  );
}
