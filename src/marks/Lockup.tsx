import type { CSSProperties } from "react";

import CollectiveScript from "./CollectiveScript";
import Seal from "./Seal";
import { COLLECTIVE_TAIL, COLLECTIVE_VIEWBOX } from "./collectiveScriptMetrics";
import {
  LOCKUP_SIZE,
  LOCKUP_SIZE_STACKED,
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

export type LockupProps = {
  /** font size of the wordmark; everything else scales from it. Defaults to the lockup's resting size, one-line or stacked (lockupMetrics.ts) */
  size?: string;
  /** force the cursive line on regardless of measured size (the splash sizes itself so it always fits) */
  script?: boolean;
  className?: string;
  style?: CSSProperties;
};

/** the wordmark's live font size in px (useMeasure re-reads it whenever the wordmark resizes) */
const readFontPx = (el: HTMLElement): number => parseFloat(getComputedStyle(el).fontSize) || 0;

/** the parts' shares of the font size, one-line and stacked, as the styles the leaves are handed — settled once, so the leaves see equal props */
const ONE_LINE = {
  scriptEm: SCRIPT_EM,
  sealEm: SEAL_EM,
  script: { height: `${SCRIPT_EM}em` } as CSSProperties,
  seal: `${SEAL_EM}em`,
  shift: sealPeriodShiftEm(COLLECTIVE_TAIL, COLLECTIVE_VIEWBOX, { scriptEm: SCRIPT_EM, sealEm: SEAL_EM }),
};
const STACKED = {
  scriptEm: STACKED_SCRIPT_EM,
  sealEm: STACKED_SEAL_EM,
  script: { height: `${STACKED_SCRIPT_EM}em` } as CSSProperties,
  seal: `${STACKED_SEAL_EM}em`,
  shift: sealPeriodShiftEm(COLLECTIVE_TAIL, COLLECTIVE_VIEWBOX, { scriptEm: STACKED_SCRIPT_EM, sealEm: STACKED_SEAL_EM }),
};

/**
 * The resting logo lockup: "Grace City" · "Collective" in script · the seal
 * as the full stop. From lg up all on one line, and "Collective" is only
 * rendered when it would stand at least 18px tall — the lockup measures its
 * own wordmark (useMeasure) and derives everything from that. Below lg it
 * stacks (#53): the wordmark on one line, the script always on a second at
 * a readable height, the seal on the script's tail line — so a phone reads
 * the whole name rather than "Grace City." The layout is the same flex row
 * wrapped, so the parts keep their order and their shared baselines.
 */
export default function Lockup({
  size,
  script: forceScript = false,
  className,
  style,
}: LockupProps) {
  const stacked = useBelowLg();
  const shares = stacked ? STACKED : ONE_LINE;
  const [wordmarkRef, fontPx] = useMeasure(readFontPx, 0);
  const script = forceScript || stacked || showScript(scriptHeightFor(fontPx, shares.scriptEm));

  // the full stop: on the tail's line after "Collective", on the baseline after "Grace City"
  const sealShift = script ? shares.shift : 0;

  return (
    <div
      data-lockup=""
      data-stacked={stacked ? "" : undefined}
      // below lg the wordmark takes the whole first line, so the script and the seal wrap under it
      className={cn(
        "flex flex-wrap items-baseline gap-x-[0.16em] gap-y-[0.18em] text-cream lg:flex-nowrap lg:gap-y-0",
        className,
      )}
      style={{ fontSize: size ?? (stacked ? LOCKUP_SIZE_STACKED : LOCKUP_SIZE), ...style }}
    >
      <span
        data-lockup="wordmark"
        ref={wordmarkRef}
        className="basis-full font-serif leading-[0.9] tracking-[-0.01em] whitespace-nowrap lg:basis-auto"
      >
        Grace City
      </span>
      {script && <CollectiveScript data-lockup="script" className="shrink-0 translate-y-[0.03em]" style={shares.script} />}
      <span className="inline-flex shrink-0 -ml-[0.09em]" style={{ transform: `translateY(${sealShift}em)` }}>
        <Seal data-lockup="seal" size={shares.seal} className="shrink-0" />
      </span>
    </div>
  );
}
