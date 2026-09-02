import type { CSSProperties } from "react";

import CollectiveScript from "./CollectiveScript";
import Seal from "./Seal";
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
import { useBelowLg } from "@/layout/breakpoint";
import { cn } from "@/lib/utils";
import { useMeasure } from "@/ui/useMeasure";

/** the hero's wordmark on one line, lg and up */
export const HERO_LOCKUP_SIZE = "clamp(30px,7.2vw,108px)";
/** the hero's wordmark stacked, below lg: room for the script under it, never taller than the headline */
export const HERO_LOCKUP_STACKED_SIZE = "clamp(34px,6.4vw,72px)";

export type LockupProps = {
  /** font size of the wordmark; everything else scales from it. Defaults to the hero's, one-line or stacked */
  size?: string;
  /** force the cursive line on regardless of measured size (the splash sizes itself so it always fits) */
  script?: boolean;
  className?: string;
  style?: CSSProperties;
};

/** the wordmark's live font size in px (useMeasure re-reads it whenever the wordmark resizes) */
const readFontPx = (el: HTMLElement): number => parseFloat(getComputedStyle(el).fontSize) || 0;

/**
 * The resting logo lockup: "Grace City" · "Collective" in script · the seal
 * as the full stop. From lg up all on one line, and "Collective" is only
 * rendered when it would stand at least 18px tall. Below lg it stacks (#53):
 * the wordmark on one line, the script always on a second at a readable
 * height, the seal on the script's tail line — so a phone reads the whole
 * name rather than "Grace City." The layout is the same flex row wrapped,
 * so the parts keep their order and their shared baselines.
 */
export default function Lockup({
  size,
  script: forceScript = false,
  className,
  style,
}: LockupProps) {
  const stacked = useBelowLg();
  const scriptEm = stacked ? STACKED_SCRIPT_EM : SCRIPT_EM;
  const sealEm = stacked ? STACKED_SEAL_EM : SEAL_EM;
  const [wordmarkRef, fontPx] = useMeasure(readFontPx, 0);
  const script = forceScript || stacked || showScript(scriptHeightFor(fontPx, scriptEm));

  // the full stop: on the tail's line after "Collective", on the baseline after "Grace City"
  const sealShift = script ? sealPeriodShiftEm(COLLECTIVE_TAIL, COLLECTIVE_VIEWBOX, { scriptEm, sealEm }) : 0;

  return (
    <div
      data-lockup=""
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
        ref={wordmarkRef}
        className="basis-full font-serif leading-[0.9] tracking-[-0.01em] whitespace-nowrap lg:basis-auto"
      >
        Grace City
      </span>
      {script && (
        <CollectiveScript
          data-lockup="script"
          className="shrink-0 translate-y-[0.03em]"
          style={{ height: `${scriptEm}em` }}
        />
      )}
      <span className="inline-flex shrink-0 -ml-[0.09em]" style={{ transform: `translateY(${sealShift}em)` }}>
        <Seal data-lockup="seal" size={`${sealEm}em`} className="shrink-0" />
      </span>
    </div>
  );
}
