/** Below this computed height "Collective" is dropped from the resting lockup. */
export const SCRIPT_MIN_PX = 18;

/** Height of the "Collective" script line as a fraction of the wordmark's font size. */
export const SCRIPT_EM = 0.55;

/** The seal is the full stop after "Collective": nav-mark size (28px) at the hero's largest. */
export const SEAL_EM = 0.26;

/** How far the script's box is nudged below the baseline so its pen line sits on it (Lockup's translate-y class). */
export const SCRIPT_NUDGE_EM = 0.03;

/**
 * Vertical shift (em, positive down) that puts a baseline-aligned seal's
 * centre on the height where the script's tail lifts off.
 */
export function sealPeriodShiftEm(tail: { y: number }, box: { height: number }): number {
  const tailAboveBaselineEm = ((box.height - tail.y) / box.height) * SCRIPT_EM - SCRIPT_NUDGE_EM;
  return SEAL_EM / 2 - tailAboveBaselineEm;
}

export function scriptHeightFor(wordmarkFontSizePx: number): number {
  return wordmarkFontSizePx * SCRIPT_EM;
}

export function showScript(scriptHeightPx: number): boolean {
  return scriptHeightPx >= SCRIPT_MIN_PX;
}
