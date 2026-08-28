export type IntroGateInput = {
  /** every parallax texture has arrived */
  loaded: boolean;
  /** one full run of the intro timeline has played */
  minimumElapsed: boolean;
  /** the visitor gestured to skip the intro */
  skipped: boolean;
};

/**
 * Whether the splash may hand off to the hero. Pure: the splash never
 * dismisses before textures are in, and — unless skipped — never before one
 * full intro run.
 */
export function introGateOpen({ loaded, minimumElapsed, skipped }: IntroGateInput): boolean {
  return loaded && (minimumElapsed || skipped);
}
