import { createContext } from "react";

import CornerOrnaments from "@/components/CornerOrnaments";
import { GLASS, GLASS_CORNERS } from "@/components/glass";
import { STACK } from "@/components/layerSplit";
import { PLAY_MARGIN, type InViewOptions } from "@/components/useInView";

// everything a scene section says sits between the canvases (layerSplit.ts),
// so the nearest figures cross it: a panel rises from behind them and rests
// with an edge tucked behind one, its words placed clear
export const between = `relative ${STACK.between}`;

/** how far outside a copy panel's edge its brackets sit */
const PANEL_BRACKET_OUT = "-10px";

/** how much of a copy panel must be on screen before its brackets come in */
const PANEL_ENTER_THRESHOLD = 0.45;

/**
 * When a stop's panel is shown, as `useInView` watches it. On desktop, once
 * most of it is on screen (its section is a viewport, so that is the turn of
 * the page). Below lg the sections are as tall as their words (#52), so the
 * next stop's panel can stand on screen before its own turn: there it is
 * shown while it is settled in the play band — enter and leave, so it fills
 * as it arrives and empties again once well past. Both start shown, so the
 * words are up until the observer says otherwise.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const PANEL_SHOWN_DESKTOP: InViewOptions = {
  threshold: PANEL_ENTER_THRESHOLD,
  initial: true,
};
// eslint-disable-next-line react-refresh/only-export-components
export const PANEL_SHOWN_BELOW_LG: InViewOptions = {
  rootMargin: PLAY_MARGIN,
  initial: true,
};

/** whether the copy panel around a component is shown, for ornaments that come in with its brackets */
// eslint-disable-next-line react-refresh/only-export-components
export const PanelShownContext = createContext(true);

/**
 * A scene stop's copy block: a panel of frosted glass, so the words read
 * over the brightest parts of the plate while the engraving still shows
 * through, with the frame's brackets just outside its edges. The whole panel
 * — glass, brackets and words — sits under the front canvas, so the nearest
 * figures cross it: it scrolls in from behind them, and at rest an edge of
 * the glass tucks behind one while the words sit clear (the glass blurs only
 * the back canvas, so a figure over it stays sharp). Nothing inside may
 * carry a step of STACK: the panel is a stacking context of its own.
 */
export default function Bracketed({
  ref,
  shown,
  className = "",
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  /** the panel, for the stop to watch (Scene) */
  ref: React.RefObject<HTMLDivElement | null>;
  /**
   * whether the panel is shown: its brackets slide home and its words rise,
   * and reset when it is not, so every turn of the page brings them in again
   */
  shown: boolean;
  className?: string;
  /** for a panel lit as a whole while the reader is over it */
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={ref}
      data-copy-panel=""
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`${between} ${GLASS} p-[clamp(18px,2.6vw,32px)] ${GLASS_CORNERS} ${className}`}
    >
      <CornerOrnaments inset={PANEL_BRACKET_OUT} shown={shown} />
      <PanelShownContext.Provider value={shown}>
        {children}
      </PanelShownContext.Provider>
    </div>
  );
}
