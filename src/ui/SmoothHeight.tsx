import { useLayoutEffect, useRef, useState, type CSSProperties, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export type SmoothHeightProps = HTMLAttributes<HTMLDivElement>;

/** how long the height takes to settle, in ms */
export const SMOOTH_HEIGHT_MS = 700;

/**
 * A block whose height eases from one content to the next instead of
 * jumping: it watches its content's height and sets its own to match, with
 * a transition on it, so whatever sits around it (a glass panel) grows and
 * shrinks smoothly as the words inside change. Until the first measure, and
 * wherever ResizeObserver is missing, the height is simply the content's.
 * The motion is only where motion is welcome.
 */
export default function SmoothHeight({ className, style, children, ...rest }: SmoothHeightProps) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => setHeight(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const sized: CSSProperties = {
    ...style,
    height: height ?? "auto",
    transitionDuration: `${SMOOTH_HEIGHT_MS}ms`,
  };
  return (
    <div
      data-smooth-height=""
      className={cn(
        "overflow-hidden motion-safe:transition-[height] motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]",
        className,
      )}
      style={sized}
      {...rest}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}
