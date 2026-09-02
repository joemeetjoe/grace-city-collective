import { useCallback, useMemo, useState } from "react";

import type { HoverHandlers } from "./Stop";

/** the ornament's switch (OrnamentSwitch): whether it is pressed, and the press that toggles it */
export type PressState = { pressed: boolean; onPress: () => void };

/**
 * Hover-to-light, once (#121): whether the reader's pointer is over a thing,
 * and the pair of handlers that say so — for a panel lit as a whole while
 * the pointer is over it (the house table seated, the program huddled, the
 * field reaped). The handlers are stable, so a panel that takes them never
 * re-renders for their sake. Beside the pointer, the press (#130): a
 * keyboard or a touch toggles the ornament's switch, and a pressed switch
 * holds the light on whichever device — `over` says the pointer alone,
 * `press.pressed` the switch, and the caller lights on either
 * (useStopPanel), so a tier that ignores the pointer still answers a press.
 */
export function useHoverLit(): { over: boolean; hover: HoverHandlers; press: PressState } {
  const [over, setOver] = useState(false);
  const [pressed, setPressed] = useState(false);
  const hover = useMemo<HoverHandlers>(
    () => ({ onMouseEnter: () => setOver(true), onMouseLeave: () => setOver(false) }),
    [],
  );
  const onPress = useCallback(() => setPressed((was) => !was), []);
  return { over, hover, press: { pressed, onPress } };
}
