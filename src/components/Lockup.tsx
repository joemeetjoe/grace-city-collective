import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import CollectiveScript from "@/components/CollectiveScript";
import Seal, { type SealProps } from "@/components/Seal";
import { SCRIPT_EM, SEAL_EM, scriptHeightFor, showScript } from "@/components/lockupMetrics";
import { cn } from "@/lib/utils";

export const HERO_LOCKUP_SIZE = "clamp(30px,7.2vw,108px)";

export type LockupProps = {
  /** font size of the wordmark; everything else scales from it */
  size?: string;
  sealVariant?: SealProps["variant"];
  className?: string;
  style?: CSSProperties;
};

/** The wordmark's live font size in px, re-measured whenever it resizes. */
function useWordmarkFontSize(ref: React.RefObject<HTMLElement | null>): number {
  const [px, setPx] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setPx(parseFloat(getComputedStyle(el).fontSize) || 0);
    measure();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return px;
}

/**
 * The resting logo lockup: seal · "Grace City" · "Collective" in script.
 * "Collective" is only rendered when it would stand at least 18px tall.
 */
export default function Lockup({ size = HERO_LOCKUP_SIZE, sealVariant = "static", className, style }: LockupProps) {
  const wordmarkRef = useRef<HTMLSpanElement>(null);
  const fontPx = useWordmarkFontSize(wordmarkRef);
  const script = showScript(scriptHeightFor(fontPx));

  return (
    <div
      data-lockup=""
      className={cn("flex items-center gap-[0.26em] text-cream", className)}
      style={{ fontSize: size, ...style }}
    >
      <Seal data-lockup="seal" variant={sealVariant} size={`${SEAL_EM}em`} className="shrink-0" />
      <div className="flex flex-col items-start">
        <span
          ref={wordmarkRef}
          data-lockup="wordmark"
          className="[font-family:'Cormorant_Garamond',Georgia,serif] leading-[0.9] tracking-[-0.01em] whitespace-nowrap"
        >
          Grace City
        </span>
        {script && (
          <CollectiveScript
            data-lockup="script"
            className="-mt-[0.02em] ml-[0.34em]"
            style={{ height: `${SCRIPT_EM}em` }}
          />
        )}
      </div>
    </div>
  );
}
