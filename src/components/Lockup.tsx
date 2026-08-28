import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import CollectiveScript from "@/components/CollectiveScript";
import Seal, { type SealProps } from "@/components/Seal";
import { SCRIPT_EM, SEAL_EM, scriptHeightFor, showScript } from "@/components/lockupMetrics";
import { STAMP_REPLAY_LABEL, useStampReplay } from "@/components/useStampReplay";
import { cn } from "@/lib/utils";

export const HERO_LOCKUP_SIZE = "clamp(30px,7.2vw,108px)";

export type LockupProps = {
  /** font size of the wordmark; everything else scales from it */
  size?: string;
  sealVariant?: SealProps["variant"];
  /** force the cursive line on regardless of measured size (the splash sizes itself so it always fits) */
  script?: boolean;
  /** the seal is a button that replays the stamp beat (the hero easter egg) */
  interactiveSeal?: boolean;
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
 *
 * Every instance carries the same `data-flip-id`s so GSAP Flip can carry one
 * instance's layout over to another (the splash hands off to the hero).
 */
export default function Lockup({
  size = HERO_LOCKUP_SIZE,
  sealVariant = "static",
  script: forceScript = false,
  interactiveSeal = false,
  className,
  style,
}: LockupProps) {
  const wordmarkRef = useRef<HTMLSpanElement>(null);
  const sealRef = useRef<SVGSVGElement>(null);
  const fontPx = useWordmarkFontSize(wordmarkRef);
  const script = forceScript || showScript(scriptHeightFor(fontPx));
  const stamp = useStampReplay(sealRef);

  const seal = (
    <Seal
      ref={sealRef}
      data-lockup="seal"
      data-flip-id="lockup-seal"
      variant={sealVariant}
      atRest={interactiveSeal}
      size={`${SEAL_EM}em`}
      className="shrink-0"
    />
  );

  return (
    <div
      data-lockup=""
      data-flip-id="lockup"
      className={cn("flex items-center gap-[0.26em] text-cream", className)}
      style={{ fontSize: size, ...style }}
    >
      {interactiveSeal ? (
        // the chrome layer is pointer-events-none; the button opts back in
        <button
          type="button"
          aria-label={STAMP_REPLAY_LABEL}
          className="pointer-events-auto inline-flex shrink-0 cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cream/60"
          {...stamp}
        >
          {seal}
        </button>
      ) : (
        seal
      )}
      <div className="flex flex-col items-start">
        <span
          ref={wordmarkRef}
          data-lockup="wordmark"
          data-flip-id="lockup-wordmark"
          className="[font-family:'Cormorant_Garamond',Georgia,serif] leading-[0.9] tracking-[-0.01em] whitespace-nowrap"
        >
          Grace City
        </span>
        {script && (
          <CollectiveScript
            data-lockup="script"
            data-flip-id="lockup-script"
            className="-mt-[0.02em] ml-[0.34em]"
            style={{ height: `${SCRIPT_EM}em` }}
          />
        )}
      </div>
    </div>
  );
}
