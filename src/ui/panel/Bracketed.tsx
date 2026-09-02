import type { ReactNode, Ref } from "react";

import CornerOrnaments from "@/ui/CornerOrnaments";
import { panel } from "@/theme/classes";
import { PanelShownContext } from "./panelShown";

/** how far outside a copy panel's edge its brackets sit */
const PANEL_BRACKET_OUT = "-10px";

/**
 * A scene stop's copy block: a panel of frosted glass, so the words read
 * over the brightest parts of the plate while the engraving still shows
 * through, with the frame's brackets just outside its edges. The whole panel
 * — glass, brackets and words — sits under the front canvas, so the nearest
 * figures cross it: it scrolls in from behind them, and at rest an edge of
 * the glass tucks behind one while the words sit clear (the glass blurs only
 * the back canvas, so a figure over it stays sharp). Nothing inside may
 * carry a step of STACK: the panel is a stacking context of its own. What
 * renders within reads whether it is shown through usePanelShown.
 */
export default function Bracketed({
  ref,
  shown,
  className = "",
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  /** the panel, for the stop to watch (useStopPanel's useInView) */
  ref: Ref<HTMLDivElement>;
  /**
   * whether the panel is shown: its brackets slide home and its words rise,
   * and reset when it is not, so every turn of the page brings them in again
   */
  shown: boolean;
  className?: string;
  /** for a panel lit as a whole while the reader is over it */
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: ReactNode;
}) {
  return (
    <div
      ref={ref}
      data-copy-panel=""
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`${panel} ${className}`}
    >
      <CornerOrnaments inset={PANEL_BRACKET_OUT} shown={shown} />
      <PanelShownContext.Provider value={shown}>
        {children}
      </PanelShownContext.Provider>
    </div>
  );
}
