/** The resting lockup's font size on one line, lg and up — the hero's wordmark, which renders it at this default. */
export const LOCKUP_SIZE = "clamp(30px,7.2vw,108px)";
/** The resting lockup's font size stacked, below lg: room for the script under it, never taller than the headline. */
export const LOCKUP_SIZE_STACKED = "clamp(34px,6.4vw,72px)";

/** Below this computed height "Collective" is dropped from the resting lockup. */
const SCRIPT_MIN_PX = 18;

/** Height of the "Collective" script line as a fraction of the wordmark's font size. */
export const SCRIPT_EM = 0.55;

/** The seal is the full stop after "Collective": nav-mark size (28px) at the hero's largest. */
export const SEAL_EM = 0.26;

/**
 * Below lg the lockup stacks (#53): "Collective" is its own line under the
 * wordmark, so it takes a larger share of the font size than the one-line
 * suffix does — it must read, not trail — and the seal grows with it, the
 * same full stop to the same script.
 */
export const STACKED_SCRIPT_EM = 0.72;
export const STACKED_SEAL_EM = 0.4;

/** How far the script's box is nudged below the baseline so its pen line sits on it (Lockup's translate-y class). */
const SCRIPT_NUDGE_EM = 0.03;

/**
 * Vertical shift (em, positive down) that puts a baseline-aligned seal's
 * centre on the height where the script's tail lifts off.
 */
export function sealPeriodShiftEm(
  tail: { y: number },
  box: { height: number },
  { scriptEm = SCRIPT_EM, sealEm = SEAL_EM }: { scriptEm?: number; sealEm?: number } = {},
): number {
  const tailAboveBaselineEm = ((box.height - tail.y) / box.height) * scriptEm - SCRIPT_NUDGE_EM;
  return sealEm / 2 - tailAboveBaselineEm;
}

export function scriptHeightFor(wordmarkFontSizePx: number, scriptEm: number = SCRIPT_EM): number {
  return wordmarkFontSizePx * scriptEm;
}

export function showScript(scriptHeightPx: number): boolean {
  return scriptHeightPx >= SCRIPT_MIN_PX;
}
