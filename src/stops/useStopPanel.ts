import { useContext, useRef } from "react";

import { ReducedMotionContext } from "@/app/contexts";
import {
  PANEL_SHOWN_BELOW_LG,
  PANEL_SHOWN_DESKTOP,
} from "@/components/panel/Bracketed";
import { useInTurn } from "@/components/useInTurn";
import { useInView } from "@/components/useInView";
import { useBelowLg } from "@/layout/breakpoint";

/**
 * On a phone a stop's ornament plays the pointer's part a beat after its
 * rows have printed in (useInTurn), so its rest state — the program, the
 * empty table, the seed, the traced emblems — is seen first, as it is on a
 * desktop before the pointer arrives; the gathering emblems then light one
 * after the next, a beat apart.
 */
export const ORNAMENT_LIT_AT_MS = 1200;
export const EMBLEM_LIT_STEP_MS = 400;

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
  const reduced = useContext(ReducedMotionContext);
  const panelRef = useRef<HTMLDivElement>(null);
  const settled = useInView(
    panelRef,
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
