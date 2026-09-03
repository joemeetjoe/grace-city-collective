import { useAppStore } from "@/state/appStore";
import { PANEL_SHOWN_BELOW_LG, PANEL_SHOWN_DESKTOP } from "@/ui/panel/panelShown";
import { useInTurn } from "@/ui/useInTurn";
import { useInView } from "@/ui/useInView";
import { useBelowLg } from "@/layout/useBelowLg";
import { EMBLEM_LIT_STEP_MS, ORNAMENT_LIT_AT_MS } from "@/theme/motion";
import type { HoverHandlers, PanelWatch } from "./Stop";
import { useHoverLit, type PressState } from "./useHoverLit";

// on a phone a stop's ornament plays the pointer's part a beat after its rows
// have printed in (useInTurn, ORNAMENT_LIT_AT_MS), so its rest state — the
// program, the empty table, the seed, the traced emblems — is seen first, as
// it is on a desktop before the pointer arrives; the gathering emblems then
// light one after the next, a beat apart (EMBLEM_LIT_STEP_MS)

/**
 * The panel logic every stop shares: the stop's panel, watched for when it
 * is shown (PANEL_SHOWN_*), and what lights its ornament on this device.
 * From lg up that is the pointer over the panel (`hover`, for the Stop to
 * take) or the ornament's switch pressed (`press`, for its OrnamentSwitch,
 * #130); below lg the same signal that shows the panel plays the ornament
 * while the panel is settled on screen, and undoes it as the panel leaves;
 * under reduced motion the panel is shown and the ornament rests. The
 * switch answers on both tiers — below lg it is the touch's only way in.
 * `lit` is that choice made, so no stop asks which device it is on.
 *
 * `count` is how many pieces light in turn below lg (EMBLEM_LIT_STEP_MS
 * apart): the gatherings' emblems pass their number and read `inTurn`;
 * every other stop's single ornament leaves the default and reads `lit` —
 * the hooks run identically either way.
 */
export function useStopPanel(count = 1): {
  /** the panel, for the Stop to watch */
  panel: PanelWatch;
  /** the pointer over the panel, for a Stop whose ornament lights as a whole */
  hover: HoverHandlers;
  /** the ornament's switch: pressed by keyboard or touch, it holds the ornament lit (OrnamentSwitch) */
  press: PressState;
  /** whether the panel is shown: what its ornaments take to come in with its brackets */
  shown: boolean;
  /** whether the stop's ornament is lit, on this device */
  lit: boolean;
  belowLg: boolean;
  /** below lg, how many of `count` pieces have lit in turn */
  inTurn: number;
} {
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
  const { over, hover, press } = useHoverLit();
  return {
    panel: { ref: panelRef, shown },
    hover,
    press,
    shown,
    // the switch answers on either tier (#130): below lg it is the touch's
    // only way in, and it holds the ornament lit past the beat it plays
    lit: (belowLg ? playing : over) || press.pressed,
    belowLg,
    inTurn,
  };
}
