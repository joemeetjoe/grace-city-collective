import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import CollectiveScript from "./CollectiveScript";
import Seal, { type SealProps } from "./Seal";
import { COLLECTIVE_TAIL, COLLECTIVE_VIEWBOX } from "./collectiveScriptMetrics";
import {
  SCRIPT_EM,
  SEAL_EM,
  STACKED_SCRIPT_EM,
  STACKED_SEAL_EM,
  scriptHeightFor,
  sealPeriodShiftEm,
  showScript,
} from "./lockupMetrics";
import { STAMP_REPLAY_LABEL, useStampReplay } from "./useStampReplay";
import { useBelowLg } from "@/layout/breakpoint";
import { cn } from "@/lib/utils";

/** the hero's wordmark on one line, lg and up */
export const HERO_LOCKUP_SIZE = "clamp(30px,7.2vw,108px)";
/** the hero's wordmark stacked, below lg: room for the script under it, never taller than the headline */
export const HERO_LOCKUP_STACKED_SIZE = "clamp(34px,6.4vw,72px)";

export type LockupProps = {
  /** font size of the wordmark; everything else scales from it. Defaults to the hero's, one-line or stacked */
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
 * The resting logo lockup: "Grace City" · "Collective" in script · the seal
 * as the full stop. From lg up all on one line, and "Collective" is only
 * rendered when it would stand at least 18px tall. Below lg it stacks (#53):
 * the wordmark on one line, the script always on a second at a readable
 * height, the seal on the script's tail line — so a phone reads the whole
 * name rather than "Grace City." The layout is the same flex row wrapped,
 * so the parts keep their order and their shared baselines.
 *
 * Every instance carries the same `data-flip-id`s so GSAP Flip can carry one
 * instance's layout over to another (the splash hands off to the hero).
 */
export default function Lockup({
  size,
  sealVariant = "static",
  script: forceScript = false,
  interactiveSeal = false,
  className,
  style,
}: LockupProps) {
  const wordmarkRef = useRef<HTMLSpanElement>(null);
  const sealRef = useRef<SVGSVGElement>(null);
  const stacked = useBelowLg();
  const scriptEm = stacked ? STACKED_SCRIPT_EM : SCRIPT_EM;
  const sealEm = stacked ? STACKED_SEAL_EM : SEAL_EM;
  const fontPx = useWordmarkFontSize(wordmarkRef);
  const script = forceScript || stacked || showScript(scriptHeightFor(fontPx, scriptEm));
  const stamp = useStampReplay(sealRef);

  const seal = (
    <Seal
      ref={sealRef}
      data-lockup="seal"
      data-flip-id="lockup-seal"
      variant={sealVariant}
      atRest={interactiveSeal}
      size={`${sealEm}em`}
      className="shrink-0"
    />
  );

  // the full stop: on the tail's line after "Collective", on the baseline after "Grace City"
  const sealShift = script ? sealPeriodShiftEm(COLLECTIVE_TAIL, COLLECTIVE_VIEWBOX, { scriptEm, sealEm }) : 0;

  return (
    <div
      data-lockup=""
      data-flip-id="lockup"
      data-stacked={stacked ? "" : undefined}
      // below lg the wordmark takes the whole first line, so the script and the seal wrap under it
      className={cn(
        "flex flex-wrap items-baseline gap-x-[0.16em] gap-y-[0.18em] text-cream lg:flex-nowrap lg:gap-y-0",
        className,
      )}
      style={{ fontSize: size ?? (stacked ? HERO_LOCKUP_STACKED_SIZE : HERO_LOCKUP_SIZE), ...style }}
    >
      <span
        data-lockup="wordmark"
        data-flip-id="lockup-wordmark"
        ref={wordmarkRef}
        className="basis-full [font-family:'Cormorant_Garamond',Georgia,serif] leading-[0.9] tracking-[-0.01em] whitespace-nowrap lg:basis-auto"
      >
        Grace City
      </span>
      {script && (
        <CollectiveScript
          data-lockup="script"
          data-flip-id="lockup-script"
          className="shrink-0 translate-y-[0.03em]"
          style={{ height: `${scriptEm}em` }}
        />
      )}
      {/* the transform lives on this wrapper, not the svg, so the stamp's own transform can be cleared freely */}
      <span className="inline-flex shrink-0 -ml-[0.09em]" style={{ transform: `translateY(${sealShift}em)` }}>
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
      </span>
    </div>
  );
}
