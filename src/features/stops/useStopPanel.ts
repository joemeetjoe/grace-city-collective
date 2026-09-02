import { useAppStore } from "@/state/appStore";
import {
  PANEL_SHOWN_BELOW_LG,
  PANEL_SHOWN_DESKTOP,
} from "@/ui/panel/Bracketed";
import { useInTurn } from "@/ui/useInTurn";
import { useInView } from "@/ui/useInView";
import { useBelowLg } from "@/layout/breakpoint";
import { EMBLEM_LIT_STEP_MS, ORNAMENT_LIT_AT_MS } from "@/theme/motion";

// on a phone a stop's ornament plays the pointer's part a beat after its rows
// have printed in (useInTurn, ORNAMENT_LIT_AT_MS), so its rest state — the
// program, the empty table, the seed, the traced emblems — is seen first, as
// it is on a desktop before the pointer arrives; the gathering emblems then
// light one after the next, a beat apart (EMBLEM_LIT_STEP_MS)

/**
 * The panel logic every stop shares: the stop's panel, watched for when it
 * is shown (PANEL_SHOWN_*). Below lg the same signal plays the stop's
 * ornament — the pointer's part on desktop — while the panel is settled on
 * screen, and undoes it as the panel leaves; under reduced motion the panel
 * is shown and the ornament rests.
 *
 * `count` is how many pieces light in turn below lg (EMBLEM_LIT_STEP_MS
 * apart): the gatherings' emblems pass their number, every other stop's
 * single ornament leaves the default — the hooks run identically either way.
 */
export function useStopPanel(count = 1) {
  const belowLg = useBelowLg();
  const reduced = useAppStore((s) => s.reducedMotion);
  const [panelRef, settled] = useInView<HTMLDivElement>(
    belowLg ? PANEL_SHOWN_BELOW_LG : PANEL_SHOWN_DESKTOP,
  );
  const shown = belowLg ? reduced || settled : settled;
  const settledIn = belowLg && !reduced && settled;
  // the stop's ornament lights a beat after it is in, and the gathering
  // emblems in turn; the calendar beside them is desktop's, lit by the pointer
  const playing = useInTurn(settledIn, 1, 0, ORNAMENT_LIT_AT_MS) > 0;
  const inTurn = useInTurn(
    settledIn,
    count,
    EMBLEM_LIT_STEP_MS,
    ORNAMENT_LIT_AT_MS,
  );
  return { panel: { ref: panelRef, shown }, belowLg, reduced, playing, inTurn };
}
