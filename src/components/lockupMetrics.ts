/** Below this computed height "Collective" is dropped from the resting lockup. */
export const SCRIPT_MIN_PX = 18;

/** Height of the "Collective" script line as a fraction of the wordmark's font size. */
export const SCRIPT_EM = 0.55;

/** Seal height as a multiple of the wordmark's cap height (≈0.7em for Cormorant). */
export const SEAL_EM = 1.2 * 0.7;

export function scriptHeightFor(wordmarkFontSizePx: number): number {
  return wordmarkFontSizePx * SCRIPT_EM;
}

export function showScript(scriptHeightPx: number): boolean {
  return scriptHeightPx >= SCRIPT_MIN_PX;
}
