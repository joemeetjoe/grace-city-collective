import { createContext } from "react";

import { PLAY_MARGIN, type InViewOptions } from "@/ui/useInView";

/** how much of a copy panel must be on screen before its brackets come in */
const PANEL_ENTER_THRESHOLD = 0.45;

/**
 * When a stop's panel is shown, as `useInView` watches it (useStopPanel). On
 * desktop, once most of it is on screen (its section is a viewport, so that
 * is the turn of the page). Below lg the sections are as tall as their
 * words, so the next stop's panel can stand on screen before its own turn:
 * there it is shown while it is settled in the play band — enter and leave,
 * so it fills as it arrives and empties again once well past. Both start
 * shown, so the words are up until the observer says otherwise.
 */
export const PANEL_SHOWN_DESKTOP: InViewOptions = {
  threshold: PANEL_ENTER_THRESHOLD,
  initial: true,
};
export const PANEL_SHOWN_BELOW_LG: InViewOptions = {
  rootMargin: PLAY_MARGIN,
  initial: true,
};

/**
 * Whether the copy panel around a component is shown: Bracketed provides
 * it, usePanelShown reads it. True outside any panel, so a kicker on the
 * bare scene draws.
 */
export const PanelShownContext = createContext(true);
