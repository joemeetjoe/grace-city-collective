import type { CSSProperties, HTMLAttributes } from "react";

import { SETTLE_MS } from "@/theme/motion";
import { cn } from "@/lib/utils";
import { useMeasure } from "./useMeasure";

export type SmoothHeightProps = HTMLAttributes<HTMLDivElement>;

/** the content's height in px (useMeasure) */
const readHeight = (el: HTMLDivElement): number => el.getBoundingClientRect().height;

/**
 * A block whose height eases from one content to the next instead of
 * jumping: it measures its content's height (useMeasure) and sets its own to
 * match, with a transition on it, so whatever sits around it (a glass panel)
 * grows and shrinks smoothly as the words inside change. Until the first
 * measure the height is simply the content's. The motion is only where
 * motion is welcome.
 */
export default function SmoothHeight({ className, style, children, ...rest }: SmoothHeightProps) {
  const [inner, height] = useMeasure<HTMLDivElement, number | null>(readHeight, null);
  const sized: CSSProperties = {
    ...style,
    height: height ?? "auto",
    transitionDuration: `${SETTLE_MS}ms`,
  };
  return (
    <div
      data-smooth-height=""
      className={cn(
        "overflow-hidden motion-safe:transition-[height] motion-safe:ease-site",
        className,
      )}
      style={sized}
      {...rest}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}
